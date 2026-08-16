// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-studio-record-')),
  'studio.db',
)

vi.mock('../catalog/models.ts', () => ({
  listMergedModels: vi.fn(async () => ({
    syncedAt: null,
    source: 'test',
    models: [
      {
        id: 'market/test',
        model: 'test/model',
        title: 'Test Model',
        category: 'image',
        provider: 'market',
        operation: 'generate',
        fields: [],
      },
    ],
  })),
}))

const { listHistory, replaceAllFromUnknown } = await import('./history.ts')
const { mirrorTaskIntoHistory, recordCreatedTask } = await import('./recordTask.ts')

describe('recordCreatedTask', () => {
  beforeEach(() => {
    replaceAllFromUnknown([])
  })

  it('upserts a history row from catalog metadata', async () => {
    await recordCreatedTask({
      provider: 'market',
      operation: 'generate',
      model: 'test/model',
      input: { prompt: 'hello' },
      created: { taskId: 't-new' },
    })
    const items = listHistory()
    expect(items).toHaveLength(1)
    expect(items[0]?.taskId).toBe('t-new')
    expect(items[0]?.model).toBe('Test Model')
    expect(items[0]?.modelId).toBe('market/test')
    expect(items[0]?.prompt).toBe('hello')
    expect(items[0]?.state).toBe('waiting')
  })
})

describe('mirrorTaskIntoHistory', () => {
  beforeEach(() => {
    replaceAllFromUnknown([])
  })

  it('updates an existing row when the task reaches a terminal state', async () => {
    await recordCreatedTask({
      provider: 'market',
      operation: 'generate',
      model: 'test/model',
      input: { prompt: 'hello' },
      created: { taskId: 't-new' },
    })
    mirrorTaskIntoHistory({
      taskId: 't-new',
      state: 'success',
      resultUrls: ['https://cdn.example.com/a.png'],
      provider: 'market',
      operation: 'generate',
      media: [{ kind: 'image', url: 'https://cdn.example.com/a.png' }],
    })
    const item = listHistory()[0]
    expect(item?.state).toBe('success')
    expect(item?.resultUrls).toEqual(['https://cdn.example.com/a.png'])
  })

  it('ignores unknown taskIds', () => {
    mirrorTaskIntoHistory({
      taskId: 'missing',
      state: 'success',
      resultUrls: [],
      provider: 'market',
      operation: 'generate',
      media: [],
    })
    expect(listHistory()).toEqual([])
  })
})
