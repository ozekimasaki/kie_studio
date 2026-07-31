// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaAsset } from '../../src/lib/models/types.ts'

const tmpDir = mkdtempSync(join(tmpdir(), 'kie-archiver-'))
process.env.STUDIO_DB_PATH = join(tmpDir, 'studio.db')

vi.mock('../kie/common.ts', () => ({
  getDownloadUrl: vi.fn(),
}))

const { getDownloadUrl } = await import('../kie/common.ts')
const { archiveTaskMedia, getMediaRoot, resolveMediaPath } = await import('./archiver.ts')

const mockedGetDownloadUrl = vi.mocked(getDownloadUrl)

describe('server/media/archiver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up downloaded files between tests
    const mediaRoot = getMediaRoot()
    if (existsSync(mediaRoot)) rmSync(mediaRoot, { recursive: true, force: true })
  })

  it('getMediaRoot resolves relative to STUDIO_DB_PATH', () => {
    expect(getMediaRoot()).toBe(join(tmpDir, 'media'))
  })

  it('resolveMediaPath joins parent of mediaRoot with localPath', () => {
    const resolved = resolveMediaPath('media/task-1/0.png')
    expect(resolved).toBe(join(tmpDir, 'media/task-1/0.png'))
  })

  it('downloads and stores media, returning localPath', async () => {
    const fakeBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer
    mockedGetDownloadUrl.mockResolvedValue('https://temp.example.com/dl')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    )

    const media: MediaAsset[] = [
      { kind: 'image', url: 'https://cdn.example.com/img.png' },
    ]
    const result = await archiveTaskMedia('task-dl', media)

    expect(result[0].localPath).toBe('media/task-dl/0.png')
    const absPath = resolveMediaPath(result[0].localPath!)
    expect(existsSync(absPath)).toBe(true)
  })

  it('skips download when localPath already exists on disk', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3]).buffer
    mockedGetDownloadUrl.mockResolvedValue('https://temp.example.com/dl')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    )

    const media: MediaAsset[] = [
      { kind: 'image', url: 'https://cdn.example.com/x.mp4' },
    ]
    // First call downloads
    const first = await archiveTaskMedia('task-skip', media)
    expect(first[0].localPath).toBe('media/task-skip/0.mp4')

    vi.clearAllMocks()
    // Second call with localPath set — should skip
    const second = await archiveTaskMedia('task-skip', first)
    expect(second[0].localPath).toBe('media/task-skip/0.mp4')
    expect(mockedGetDownloadUrl).not.toHaveBeenCalled()
  })

  it('returns asset without localPath on download failure', async () => {
    mockedGetDownloadUrl.mockRejectedValue(new Error('network error'))

    const media: MediaAsset[] = [
      { kind: 'video', url: 'https://cdn.example.com/vid.mp4' },
    ]
    const result = await archiveTaskMedia('task-fail', media)

    expect(result[0].localPath).toBeUndefined()
    expect(result[0].url).toBe('https://cdn.example.com/vid.mp4')
  })

  it('handles assets without url gracefully', async () => {
    const media: MediaAsset[] = [{ kind: 'image' }]
    const result = await archiveTaskMedia('task-nourl', media)
    expect(result[0].localPath).toBeUndefined()
    expect(mockedGetDownloadUrl).not.toHaveBeenCalled()
  })

  it('rejects unsafe taskId with path traversal characters', async () => {
    const media: MediaAsset[] = [
      { kind: 'image', url: 'https://cdn.example.com/img.png' },
    ]
    const result = await archiveTaskMedia('../../evil', media)
    expect(result).toEqual(media)
    expect(mockedGetDownloadUrl).not.toHaveBeenCalled()
  })

  it('deduplicates concurrent calls for the same taskId', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3]).buffer
    mockedGetDownloadUrl.mockResolvedValue('https://temp.example.com/dl')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    )

    const media: MediaAsset[] = [
      { kind: 'image', url: 'https://cdn.example.com/dup.png' },
    ]
    // Fire two concurrent calls
    const [r1, r2] = await Promise.all([
      archiveTaskMedia('task-dedup', media),
      archiveTaskMedia('task-dedup', media),
    ])
    // Both should resolve to the same result
    expect(r1[0].localPath).toBe('media/task-dedup/0.png')
    expect(r2[0].localPath).toBe('media/task-dedup/0.png')
    // getDownloadUrl should only be called once (deduplication)
    expect(mockedGetDownloadUrl).toHaveBeenCalledTimes(1)
  })

  it('falls back to kind-based extension when URL has none', async () => {
    const fakeBytes = new Uint8Array([1]).buffer
    mockedGetDownloadUrl.mockResolvedValue('https://temp.example.com/dl')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(fakeBytes, { status: 200 }),
    )

    const media: MediaAsset[] = [
      { kind: 'audio', url: 'https://cdn.example.com/stream-no-ext' },
    ]
    const result = await archiveTaskMedia('task-ext', media)
    expect(result[0].localPath).toBe('media/task-ext/0.mp3')
  })
})
