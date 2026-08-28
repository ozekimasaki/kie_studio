import { describe, expect, it } from 'vitest'
import {
  isExpiredSignedUrl,
  isLocalMediaSrc,
  isRefreshableRemoteUrl,
  parseSignedUrlTimestamp,
} from './mediaExpiry.ts'

const TOS_EXPIRED =
  'https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/doubao-seedream-5-0-pro/x.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Date=20260722T091117Z&X-Tos-Expires=86400&X-Tos-Signature=abc'

describe('parseSignedUrlTimestamp', () => {
  it('parses compact TOS UTC timestamps', () => {
    expect(parseSignedUrlTimestamp('20260722T091117Z')).toBe(
      Date.parse('2026-07-22T09:11:17Z'),
    )
  })
})

describe('isExpiredSignedUrl', () => {
  it('treats TOS signed URLs past X-Tos-Expires as expired', () => {
    const now = Date.parse('2026-08-28T00:00:00Z')
    expect(isExpiredSignedUrl(TOS_EXPIRED, now)).toBe(true)
  })

  it('treats TOS signed URLs within the TTL as fresh', () => {
    const now = Date.parse('2026-07-22T10:00:00Z')
    expect(isExpiredSignedUrl(TOS_EXPIRED, now)).toBe(false)
  })

  it('returns false for unsigned URLs', () => {
    expect(isExpiredSignedUrl('https://cdn.example.com/fox.png')).toBe(false)
  })
})

describe('isRefreshableRemoteUrl', () => {
  it('accepts Volces TOS signed URLs', () => {
    expect(isRefreshableRemoteUrl(TOS_EXPIRED)).toBe(true)
  })

  it('rejects local and generic fixtures', () => {
    expect(isRefreshableRemoteUrl('https://cdn.example.com/fox.png')).toBe(false)
    expect(isRefreshableRemoteUrl('/media/task/0.png')).toBe(false)
  })
})

describe('isLocalMediaSrc', () => {
  it('recognizes studio media paths', () => {
    expect(isLocalMediaSrc('/media/task/0.png')).toBe(true)
    expect(isLocalMediaSrc('http://127.0.0.1:8787/media/task/0.png')).toBe(true)
    expect(isLocalMediaSrc(TOS_EXPIRED)).toBe(false)
  })
})
