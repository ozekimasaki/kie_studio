import { describe, expect, it } from 'vitest'
import {
  isTerminalState,
  mergeServerHistory,
  normalizeHistoryItems,
} from './history.ts'
import type { HistoryItem } from './models/types.ts'

describe('history migration', () => {
  it('migrates legacy resultUrls into media without losing the URLs', () => {
    const [item] = normalizeHistoryItems([{
      taskId: 'legacy-audio',
      model: 'elevenlabs/tts',
      category: 'audio',
      state: 'success',
      createdAt: Date.now(),
      resultUrls: ['https://cdn.example.com/voice.mp3'],
    }], 'local')
    expect(item?.resultUrls).toEqual(['https://cdn.example.com/voice.mp3'])
    expect(item?.media).toEqual([{ kind: 'audio', url: 'https://cdn.example.com/voice.mp3' }])
    expect(item?.provider).toBe('market')
    expect(item?.operation).toBe('generate')
  })

  it('keeps partial and expired terminal states during import', () => {
    const items = normalizeHistoryItems([
      { taskId: 'partial', model: 'suno', category: 'audio', state: 'partial', createdAt: 1 },
      { taskId: 'expired', model: 'runway', category: 'video', state: 'expired', createdAt: 2 },
    ], 'import')
    expect(items.map((item) => item.state)).toEqual(['expired', 'partial'])
  })
})

function item(
  taskId: string,
  extra: Partial<HistoryItem> = {},
): HistoryItem {
  return {
    taskId,
    model: 'test/model',
    category: 'image',
    state: 'waiting',
    createdAt: 1_000,
    ...extra,
  }
}

describe('isTerminalState', () => {
  it('treats success/fail/partial/expired as terminal', () => {
    expect(isTerminalState('success')).toBe(true)
    expect(isTerminalState('fail')).toBe(true)
    expect(isTerminalState('partial')).toBe(true)
    expect(isTerminalState('expired')).toBe(true)
    expect(isTerminalState('generating')).toBe(false)
    expect(isTerminalState('waiting')).toBe(false)
  })
})

describe('mergeServerHistory', () => {
  it('adds unknown server taskIds into the local list', () => {
    const merged = mergeServerHistory(
      [item('local-only')],
      [item('cli-new', { state: 'generating', createdAt: 2_000 })],
    )
    expect(merged.map((entry) => entry.taskId).sort()).toEqual([
      'cli-new',
      'local-only',
    ])
  })

  it('prefers terminal server state over local pending and keeps the local pin', () => {
    const merged = mergeServerHistory(
      [item('t-1', { state: 'generating', pinned: true })],
      [item('t-1', { state: 'success', resultUrls: ['https://cdn.example.com/a.png'] })],
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.state).toBe('success')
    expect(merged[0]?.pinned).toBe(true)
    expect(merged[0]?.resultUrls).toEqual(['https://cdn.example.com/a.png'])
  })

  it('does not let a pending server snapshot overwrite a local terminal item', () => {
    const merged = mergeServerHistory(
      [item('t-1', { state: 'success', resultUrls: ['https://cdn.example.com/a.png'] })],
      [item('t-1', { state: 'generating' })],
    )
    expect(merged[0]?.state).toBe('success')
  })
})
