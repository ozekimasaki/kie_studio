import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTextWithRetry, shouldKeepExistingCatalog, shouldReseedCatalog } from './sync.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('catalog page retries', () => {
  it('retries a transient fetch failure', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(new Response('openapi'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchTextWithRetry('https://example.com/model.md', 3, 0),
    ).resolves.toBe('openapi')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('catalog shrink protection', () => {
  it('keeps an existing catalog when the replacement falls below 70%', () => {
    expect(shouldKeepExistingCatalog(110, 76, false)).toBe(true)
    expect(shouldKeepExistingCatalog(9, 6, false)).toBe(true)
  })

  it('accepts a catalog at the 70% boundary', () => {
    expect(shouldKeepExistingCatalog(110, 77, false)).toBe(false)
    expect(shouldKeepExistingCatalog(0, 0, false)).toBe(false)
  })

  it('lets an explicit force sync bypass shrink protection', () => {
    expect(shouldKeepExistingCatalog(110, 0, true)).toBe(false)
  })
})

describe('desktop catalog reseed', () => {
  it('reseeds when userData catalog is missing', () => {
    expect(
      shouldReseedCatalog({ syncedAt: '2026-09-17T00:00:00.000Z' }, null),
    ).toBe(true)
  })

  it('reseeds when the bundled snapshot is newer than userData', () => {
    expect(
      shouldReseedCatalog(
        { syncedAt: '2026-09-17T07:55:52.332Z' },
        { syncedAt: '2026-08-11T16:43:07.009Z' },
      ),
    ).toBe(true)
  })

  it('keeps a userData catalog that was synced later than the bundle', () => {
    expect(
      shouldReseedCatalog(
        { syncedAt: '2026-09-17T07:55:52.332Z' },
        { syncedAt: '2026-09-17T08:10:00.000Z' },
      ),
    ).toBe(false)
  })

  it('keeps userData when timestamps are equal', () => {
    expect(
      shouldReseedCatalog(
        { syncedAt: '2026-09-17T07:55:52.332Z' },
        { syncedAt: '2026-09-17T07:55:52.332Z' },
      ),
    ).toBe(false)
  })

  it('reseeds unreadable timestamps on disk when the bundle has syncedAt', () => {
    expect(
      shouldReseedCatalog({ syncedAt: '2026-09-17T00:00:00.000Z' }, { syncedAt: 'not-a-date' }),
    ).toBe(true)
  })

  it('does not overwrite userData when the bundle has no syncedAt', () => {
    expect(
      shouldReseedCatalog({ syncedAt: null }, { syncedAt: '2026-08-11T16:43:07.009Z' }),
    ).toBe(false)
  })
})
