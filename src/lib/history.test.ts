import { describe, expect, it } from 'vitest'
import { normalizeHistoryItems } from './history.ts'

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
