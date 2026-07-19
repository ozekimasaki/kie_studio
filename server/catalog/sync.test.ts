import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchTextWithRetry, shouldKeepExistingCatalog } from './sync.ts'

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
