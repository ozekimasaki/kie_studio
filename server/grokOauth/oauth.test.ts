// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isExpiring, jwtExpiry, OAuthError, validateXaiEndpoint } from './oauth.ts'

function makeJwt(exp: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`
}

describe('jwtExpiry', () => {
  it('parses exp claim', () => {
    expect(jwtExpiry(makeJwt(1234567890))).toBe(1234567890)
  })

  it('returns null for opaque tokens', () => {
    expect(jwtExpiry('not-a-jwt')).toBeNull()
    expect(jwtExpiry('a.%%%.c')).toBeNull()
  })
})

describe('isExpiring', () => {
  it('is true when inside skew window', () => {
    const soon = Math.floor(Date.now() / 1000) + 30
    expect(isExpiring(makeJwt(soon), 120)).toBe(true)
  })

  it('is false when far from expiry', () => {
    const later = Math.floor(Date.now() / 1000) + 3600
    expect(isExpiring(makeJwt(later), 120)).toBe(false)
  })

  it('is false for opaque tokens', () => {
    expect(isExpiring('opaque-token', 120)).toBe(false)
  })
})

describe('validateXaiEndpoint', () => {
  it('accepts x.ai origins', () => {
    expect(validateXaiEndpoint('https://auth.x.ai/oauth2/token', 'token_endpoint')).toBe(
      'https://auth.x.ai/oauth2/token',
    )
    expect(validateXaiEndpoint('https://x.ai/oauth2/token', 'token_endpoint')).toBe(
      'https://x.ai/oauth2/token',
    )
  })

  it('rejects other origins and plain http', () => {
    expect(() =>
      validateXaiEndpoint('https://evil.example.com/token', 'token_endpoint'),
    ).toThrow(OAuthError)
    expect(() => validateXaiEndpoint('https://notx.ai/token', 'token_endpoint')).toThrow(
      OAuthError,
    )
    expect(() => validateXaiEndpoint('http://auth.x.ai/token', 'token_endpoint')).toThrow(
      OAuthError,
    )
  })
})
