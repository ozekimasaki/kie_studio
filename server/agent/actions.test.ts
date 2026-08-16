// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryItem, NormalizedTask } from '../../src/lib/models/types.ts'

process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-agent-actions-')),
  'studio.db',
)

vi.mock('../kie/adapters/index.ts', () => ({
  getProviderAdapter: vi.fn(),
}))

const { getProviderAdapter } = await import('../kie/adapters/index.ts')
const { getTaskStatus } = await import('./actions.ts')
const { replaceAllFromUnknown, upsertHistoryItem } = await import('../db/history.ts')

function makeItem(
  taskId: string,
  extra: Partial<HistoryItem> = {},
): HistoryItem {
  return {
    taskId,
    model: 'test/model',
    category: 'audio',
    state: 'generating',
    createdAt: Date.now(),
    ...extra,
  }
}

function makeTask(extra: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    taskId: 't-suno',
    state: 'generating',
    resultUrls: [],
    provider: 'suno',
    operation: 'extend',
    media: [],
    ...extra,
  }
}

describe('getTaskStatus', () => {
  beforeEach(() => {
    replaceAllFromUnknown([])
    vi.mocked(getProviderAdapter).mockReset()
  })

  it('prefers history provider/operation over a hallucinated market/generate', async () => {
    upsertHistoryItem(
      makeItem('t-suno', { provider: 'suno', operation: 'extend' }),
    )
    const getTask = vi.fn(async () => makeTask())
    vi.mocked(getProviderAdapter).mockReturnValue({ getTask } as never)

    await getTaskStatus({
      taskId: 't-suno',
      provider: 'market',
      operation: 'generate',
    })

    expect(getProviderAdapter).toHaveBeenCalledWith('suno')
    expect(getTask).toHaveBeenCalledWith('t-suno', 'extend')
  })

  it('falls back to market/generate when history is missing and args are omitted', async () => {
    const getTask = vi.fn(async () =>
      makeTask({ taskId: 't-new', provider: 'market', operation: 'generate' }),
    )
    vi.mocked(getProviderAdapter).mockReturnValue({ getTask } as never)

    await getTaskStatus({ taskId: 't-new' })

    expect(getProviderAdapter).toHaveBeenCalledWith('market')
    expect(getTask).toHaveBeenCalledWith('t-new', 'generate')
  })

  it('uses explicit args when the task is not in history', async () => {
    const getTask = vi.fn(async () =>
      makeTask({
        taskId: 't-runway',
        provider: 'runway',
        operation: 'aleph',
      }),
    )
    vi.mocked(getProviderAdapter).mockReturnValue({ getTask } as never)

    await getTaskStatus({
      taskId: 't-runway',
      provider: 'runway',
      operation: 'aleph',
    })

    expect(getProviderAdapter).toHaveBeenCalledWith('runway')
    expect(getTask).toHaveBeenCalledWith('t-runway', 'aleph')
  })
})
