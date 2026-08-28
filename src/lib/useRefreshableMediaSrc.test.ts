import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefreshableMediaSrc } from './useRefreshableMediaSrc.ts'

const fetchDownloadUrl = vi.fn()

vi.mock('./api.ts', () => ({
  fetchDownloadUrl: (...args: unknown[]) => fetchDownloadUrl(...args),
}))

const TOS_EXPIRED =
  'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/x.png?X-Tos-Date=20260722T091117Z&X-Tos-Expires=86400&X-Tos-Signature=abc'

describe('useRefreshableMediaSrc', () => {
  afterEach(() => {
    cleanup()
    fetchDownloadUrl.mockReset()
  })

  beforeEach(() => {
    fetchDownloadUrl.mockResolvedValue({
      data: { downloadUrl: 'https://fresh.example.com/x.png' },
    })
  })

  it('uses a fresh unsigned URL as-is without calling download-url', () => {
    const { result } = renderHook(() =>
      useRefreshableMediaSrc('https://cdn.example.com/fox.png'),
    )
    expect(result.current.displaySrc).toBe('https://cdn.example.com/fox.png')
    expect(result.current.failed).toBe(false)
    expect(fetchDownloadUrl).not.toHaveBeenCalled()
  })

  it('does not set an expired TOS URL as img src and refreshes it', async () => {
    const { result } = renderHook(() => useRefreshableMediaSrc(TOS_EXPIRED))
    expect(result.current.displaySrc).toBeUndefined()
    await waitFor(() => {
      expect(result.current.displaySrc).toBe('https://fresh.example.com/x.png')
    })
    expect(fetchDownloadUrl).toHaveBeenCalledWith(TOS_EXPIRED)
    expect(result.current.failed).toBe(false)
  })

  it('marks failed when an expired URL cannot be refreshed', async () => {
    fetchDownloadUrl.mockRejectedValueOnce(new Error('gone'))
    const { result } = renderHook(() => useRefreshableMediaSrc(TOS_EXPIRED))
    await waitFor(() => {
      expect(result.current.failed).toBe(true)
    })
    expect(result.current.displaySrc).toBeUndefined()
  })
})
