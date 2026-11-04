import { cleanup, renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRefreshableMediaSrc } from './useRefreshableMediaSrc.ts'

const fetchDownloadUrl = vi.fn()

vi.mock('./api.ts', () => ({
  fetchDownloadUrl: (...args: unknown[]) => fetchDownloadUrl(...args),
}))

const TOS_EXPIRED =
  'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/x.png?X-Tos-Date=20260722T091117Z&X-Tos-Expires=86400&X-Tos-Signature=abc'
const TOS_FRESH_A =
  'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/a.png?X-Tos-Date=20990101T000000Z&X-Tos-Expires=86400&X-Tos-Signature=aaa'
const TOS_FRESH_B =
  'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/b.png?X-Tos-Date=20990101T000000Z&X-Tos-Expires=86400&X-Tos-Signature=bbb'

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
    expect(fetchDownloadUrl).toHaveBeenCalledWith(
      TOS_EXPIRED,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
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

  it('ignores a late onError refresh after src changes', async () => {
    let resolveA: ((value: { data: { downloadUrl: string } }) => void) | undefined
    fetchDownloadUrl.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveA = resolve
        }),
    )
    const { result, rerender } = renderHook(
      ({ src }: { src: string }) => useRefreshableMediaSrc(src),
      { initialProps: { src: TOS_FRESH_A } },
    )
    expect(result.current.displaySrc).toBe(TOS_FRESH_A)

    result.current.onError()
    expect(fetchDownloadUrl).toHaveBeenCalledWith(
      TOS_FRESH_A,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    rerender({ src: TOS_FRESH_B })
    expect(result.current.displaySrc).toBe(TOS_FRESH_B)

    resolveA?.({ data: { downloadUrl: 'https://fresh.example.com/stale-a.png' } })
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.displaySrc).toBe(TOS_FRESH_B)
    expect(result.current.failed).toBe(false)
  })
})
