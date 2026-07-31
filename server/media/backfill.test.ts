// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MediaAsset } from '../../src/lib/models/types.ts'

vi.mock('./archiver.ts', () => ({
  archiveTaskMedia: vi.fn(),
}))

vi.mock('../db/history.ts', () => ({
  listUnarchivedMedia: vi.fn(),
  updateMediaLocalPaths: vi.fn(),
}))

const { archiveTaskMedia } = await import('./archiver.ts')
const { listUnarchivedMedia, updateMediaLocalPaths } = await import('../db/history.ts')
const { startBackfill, backfillRoutes } = await import('./backfill.ts')

const mockedArchive = vi.mocked(archiveTaskMedia)
const mockedList = vi.mocked(listUnarchivedMedia)
const mockedUpdate = vi.mocked(updateMediaLocalPaths)

describe('server/media/backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('startBackfill processes unarchived items and updates DB', async () => {
    const media: MediaAsset[] = [{ kind: 'image', url: 'https://cdn.example.com/a.png' }]
    mockedList.mockReturnValue([{ taskId: 't-1', media }])
    mockedArchive.mockResolvedValue([
      { kind: 'image', url: 'https://cdn.example.com/a.png', localPath: 'media/t-1/0.png' },
    ])

    startBackfill()
    // Allow the fire-and-forget promise to resolve
    await vi.waitFor(() => {
      expect(mockedUpdate).toHaveBeenCalledWith('t-1', expect.any(Array))
    })
    expect(mockedArchive).toHaveBeenCalledWith('t-1', media)
  })

  it('does not call update when archive yields no localPath', async () => {
    const media: MediaAsset[] = [{ kind: 'image', url: 'https://cdn.example.com/b.png' }]
    mockedList.mockReturnValue([{ taskId: 't-2', media }])
    mockedArchive.mockResolvedValue([
      { kind: 'image', url: 'https://cdn.example.com/b.png' },
    ])

    startBackfill()
    await vi.waitFor(() => {
      expect(mockedArchive).toHaveBeenCalled()
    })
    // Give microtask queue a tick to ensure update is NOT called
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedUpdate).not.toHaveBeenCalled()
  })

  it('handles empty unarchived list gracefully', async () => {
    mockedList.mockReturnValue([])
    startBackfill()
    await new Promise((r) => setTimeout(r, 10))
    expect(mockedArchive).not.toHaveBeenCalled()
  })

  it('backfill route returns started status', async () => {
    mockedList.mockReturnValue([])
    const app = backfillRoutes
    const res = await app.request('/media/backfill', { method: 'POST' })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { status: string } }
    expect(body.data.status).toMatch(/^(started|already_running)$/)
  })
})
