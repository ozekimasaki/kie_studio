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
  historyCount,
  importHistoryItems,
  listHistory,
  migrateHistoryItems,
  replaceAllFromUnknown,
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
})
