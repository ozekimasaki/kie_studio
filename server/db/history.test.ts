// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { HistoryItem } from '../../src/lib/models/types.ts'

// open.ts は import 時に STUDIO_DB_PATH を解決するため、動的 import の前に
// テスト専用の一時 DB パスを設定する
process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-studio-db-')),
  'studio.db',
)

const {
  clearUnpinnedHistory,
  deleteHistoryItem,
  historyCount,
  importHistoryItems,
  listHistory,
  listUnarchivedMedia,
  migrateHistoryItems,
  replaceAllFromUnknown,
  updateMediaLocalPaths,
  upsertHistoryItem,
  upsertHistoryItemsFromUnknown,
} = await import('./history.ts')

function makeItem(
  taskId: string,
  createdAt: number,
  extra: Partial<HistoryItem> = {},
): HistoryItem {
  return {
    taskId,
    model: 'test/model',
    category: 'image',
    state: 'success',
    createdAt,
    ...extra,
  }
}

describe('server/db/history', () => {
  beforeEach(() => {
    replaceAllFromUnknown([])
  })

  it('rejects a non-array payload', () => {
    expect(() => replaceAllFromUnknown({ not: 'an array' })).toThrow(
      'items must be an array',
    )
    expect(() => importHistoryItems('nope')).toThrow('items must be an array')
    expect(() => migrateHistoryItems(42)).toThrow('items must be an array')
  })

  it('stores items and returns them newest first with pinned items on top', () => {
    replaceAllFromUnknown([
      makeItem('t-old', 1_000, { pinned: true }),
      makeItem('t-mid', 2_000),
      makeItem('t-new', 3_000),
    ])
    const items = listHistory()
    expect(items.map((i) => i.taskId)).toEqual(['t-old', 't-new', 't-mid'])
    expect(historyCount()).toBe(3)
  })

  it('applies limit/offset pagination', () => {
    replaceAllFromUnknown([
      makeItem('t-1', 1_000),
      makeItem('t-2', 2_000),
      makeItem('t-3', 3_000),
      makeItem('t-4', 4_000),
    ])
    expect(listHistory({ limit: 2 }).map((i) => i.taskId)).toEqual(['t-4', 't-3'])
    expect(listHistory({ limit: 2, offset: 2 }).map((i) => i.taskId)).toEqual([
      't-2',
      't-1',
    ])
    expect(listHistory({ limit: 10, offset: 4 })).toEqual([])
  })

  it('drops malformed entries while normalizing', () => {
    const stored = replaceAllFromUnknown([
      makeItem('t-ok', 1_000),
      { taskId: 42, model: 'broken' },
      null,
      'garbage',
    ])
    expect(stored.map((i) => i.taskId)).toEqual(['t-ok'])
  })

  it('keeps existing rows when importing duplicate taskIds', () => {
    replaceAllFromUnknown([makeItem('t-dup', 1_000, { prompt: 'original' })])
    const merged = importHistoryItems([
      makeItem('t-dup', 5_000, { prompt: 'imported' }),
      makeItem('t-added', 2_000),
    ])
    const dup = merged.find((i) => i.taskId === 't-dup')
    expect(dup?.prompt).toBe('original')
    expect(merged.some((i) => i.taskId === 't-added')).toBe(true)
  })

  it('fills an empty DB via migration and merges into a non-empty DB', () => {
    const migrated = migrateHistoryItems([makeItem('t-a', 1_000)])
    expect(migrated.map((i) => i.taskId)).toEqual(['t-a'])

    const merged = migrateHistoryItems([
      makeItem('t-a', 9_000, { prompt: 'incoming' }),
      makeItem('t-b', 2_000),
    ])
    expect(merged.find((i) => i.taskId === 't-a')?.prompt).toBeUndefined()
    expect(merged.some((i) => i.taskId === 't-b')).toBe(true)
  })

  describe('updateMediaLocalPaths', () => {
    it('merges localPath into existing media JSON by URL match', () => {
      replaceAllFromUnknown([
        makeItem('t-ml', Date.now(), {
          media: [
            { kind: 'image', url: 'https://cdn.example.com/a.png' },
            { kind: 'image', url: 'https://cdn.example.com/b.png' },
          ],
        }),
      ])
      updateMediaLocalPaths('t-ml', [
        { kind: 'image', url: 'https://cdn.example.com/a.png', localPath: 'media/t-ml/0.png' },
        { kind: 'image', url: 'https://cdn.example.com/b.png' },
      ])
      const item = listHistory().find((i) => i.taskId === 't-ml')
      expect(item?.media?.[0]?.localPath).toBe('media/t-ml/0.png')
      expect(item?.media?.[1]?.localPath).toBeUndefined()
    })

    it('matches by URL even when array order differs', () => {
      replaceAllFromUnknown([
        makeItem('t-ord', Date.now(), {
          media: [
            { kind: 'image', url: 'https://cdn.example.com/first.png' },
            { kind: 'video', url: 'https://cdn.example.com/second.mp4' },
          ],
        }),
      ])
      // Archived result in reverse order
      updateMediaLocalPaths('t-ord', [
        { kind: 'video', url: 'https://cdn.example.com/second.mp4', localPath: 'media/t-ord/1.mp4' },
        { kind: 'image', url: 'https://cdn.example.com/first.png', localPath: 'media/t-ord/0.png' },
      ])
      const item = listHistory().find((i) => i.taskId === 't-ord')
      expect(item?.media?.[0]?.localPath).toBe('media/t-ord/0.png')
      expect(item?.media?.[1]?.localPath).toBe('media/t-ord/1.mp4')
    })

    it('does nothing for a non-existent taskId', () => {
      replaceAllFromUnknown([makeItem('t-x', Date.now())])
      expect(() =>
        updateMediaLocalPaths('no-such', [{ kind: 'image', localPath: 'x' }]),
      ).not.toThrow()
    })
  })

  describe('replaceAllHistory preserves localPath', () => {
    it('retains server-managed localPath across client full-replace', () => {
      const now = Date.now()
      replaceAllFromUnknown([
        makeItem('t-preserve', now, {
          media: [{ kind: 'image', url: 'https://cdn.example.com/p.png' }],
        }),
      ])
      // Simulate server archiving
      updateMediaLocalPaths('t-preserve', [
        { kind: 'image', url: 'https://cdn.example.com/p.png', localPath: 'media/t-preserve/0.png' },
      ])
      // Client PUT without localPath (as it would from polling)
      replaceAllFromUnknown([
        makeItem('t-preserve', now, {
          media: [{ kind: 'image', url: 'https://cdn.example.com/p.png' }],
        }),
      ])
      const item = listHistory().find((i) => i.taskId === 't-preserve')
      expect(item?.media?.[0]?.localPath).toBe('media/t-preserve/0.png')
    })
  })

  describe('listUnarchivedMedia', () => {
    it('returns only success/partial items without localPath', () => {
      const now = Date.now()
      replaceAllFromUnknown([
        makeItem('t-archived', now, {
          media: [{ kind: 'image', url: 'https://x.com/a.png', localPath: 'media/t/0.png' }],
        }),
        makeItem('t-unarchived', now - 1_000, {
          media: [{ kind: 'image', url: 'https://x.com/b.png' }],
        }),
        makeItem('t-failed', now - 2_000, {
          state: 'fail',
          media: [{ kind: 'image', url: 'https://x.com/c.png' }],
        }),
      ])
      const result = listUnarchivedMedia()
      expect(result).toHaveLength(1)
      expect(result[0].taskId).toBe('t-unarchived')
    })

    it('excludes items older than 13 days', () => {
      const now = Date.now()
      const old = now - 14 * 24 * 60 * 60 * 1000 // 14 days ago
      replaceAllFromUnknown([
        makeItem('t-old', old, {
          media: [{ kind: 'image', url: 'https://x.com/old.png' }],
        }),
        makeItem('t-recent', now, {
          media: [{ kind: 'image', url: 'https://x.com/new.png' }],
        }),
      ])
      const result = listUnarchivedMedia()
      expect(result).toHaveLength(1)
      expect(result[0].taskId).toBe('t-recent')
    })

    it('respects the limit parameter', () => {
      const now = Date.now()
      replaceAllFromUnknown([
        makeItem('t-u1', now - 1_000, { media: [{ kind: 'image', url: 'https://x.com/1.png' }] }),
        makeItem('t-u2', now - 2_000, { media: [{ kind: 'image', url: 'https://x.com/2.png' }] }),
        makeItem('t-u3', now - 3_000, { media: [{ kind: 'image', url: 'https://x.com/3.png' }] }),
      ])
      expect(listUnarchivedMedia(2)).toHaveLength(2)
    })
  })

  describe('upsertHistoryItemsFromUnknown', () => {
    it('keeps rows the payload does not mention', () => {
      replaceAllFromUnknown([
        makeItem('t-cli', 1_000),
        makeItem('t-ui', 2_000),
      ])
      const stored = upsertHistoryItemsFromUnknown([
        makeItem('t-ui', 2_000, { prompt: 'updated' }),
      ])
      expect(stored.map((i) => i.taskId).sort()).toEqual(['t-cli', 't-ui'])
      expect(stored.find((i) => i.taskId === 't-ui')?.prompt).toBe('updated')
    })

    it('does not regress a terminal row to a pending state', () => {
      replaceAllFromUnknown([
        makeItem('t-done', 1_000, {
          state: 'success',
          resultUrls: ['https://cdn.example.com/a.png'],
        }),
      ])
      upsertHistoryItemsFromUnknown([
        makeItem('t-done', 1_000, { state: 'generating' }),
      ])
      const item = listHistory().find((i) => i.taskId === 't-done')
      expect(item?.state).toBe('success')
      expect(item?.resultUrls).toEqual(['https://cdn.example.com/a.png'])
    })

    it('updates pin flags without wiping sibling rows', () => {
      replaceAllFromUnknown([
        makeItem('t-a', 1_000),
        makeItem('t-b', 2_000),
      ])
      upsertHistoryItemsFromUnknown([makeItem('t-a', 1_000, { pinned: true })])
      const items = listHistory()
      expect(items.find((i) => i.taskId === 't-a')?.pinned).toBe(true)
      expect(items.some((i) => i.taskId === 't-b')).toBe(true)
    })

    it('preserves server-managed localPath when the client omits it', () => {
      const now = Date.now()
      replaceAllFromUnknown([
        makeItem('t-preserve', now, {
          media: [{ kind: 'image', url: 'https://cdn.example.com/p.png' }],
        }),
      ])
      updateMediaLocalPaths('t-preserve', [
        { kind: 'image', url: 'https://cdn.example.com/p.png', localPath: 'media/t-preserve/0.png' },
      ])
      upsertHistoryItemsFromUnknown([
        makeItem('t-preserve', now, {
          media: [{ kind: 'image', url: 'https://cdn.example.com/p.png' }],
        }),
      ])
      const item = listHistory().find((i) => i.taskId === 't-preserve')
      expect(item?.media?.[0]?.localPath).toBe('media/t-preserve/0.png')
    })
  })

  describe('deleteHistoryItem and clearUnpinnedHistory', () => {
    it('deletes one row by taskId', () => {
      replaceAllFromUnknown([
        makeItem('t-keep', 1_000),
        makeItem('t-drop', 2_000),
      ])
      expect(deleteHistoryItem('t-drop')).toBe(true)
      expect(deleteHistoryItem('missing')).toBe(false)
      expect(listHistory().map((i) => i.taskId)).toEqual(['t-keep'])
    })

    it('clears unpinned rows and keeps pins', () => {
      replaceAllFromUnknown([
        makeItem('t-pin', 1_000, { pinned: true }),
        makeItem('t-gone', 2_000),
      ])
      const remaining = clearUnpinnedHistory()
      expect(remaining.map((i) => i.taskId)).toEqual(['t-pin'])
    })
  })

  it('upsertHistoryItem writes a single row', () => {
    replaceAllFromUnknown([])
    upsertHistoryItem(makeItem('t-one', 1_000, { prompt: 'hi' }))
    expect(listHistory()).toHaveLength(1)
    expect(listHistory()[0]?.prompt).toBe('hi')
  })
})
