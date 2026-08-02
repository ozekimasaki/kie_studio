// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function makeJwt(exp: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`
}

describe('resolveAccessToken', () => {
  let home: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'grok-oauth-cred-'))
    process.env.GROK_OAUTH_PROXY_HOME = home
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  it('throws not_logged_in when auth store is missing', async () => {
    const { resolveAccessToken } = await import('./credentials.ts')
    const { OAuthError } = await import('./oauth.ts')
    await expect(resolveAccessToken()).rejects.toBeInstanceOf(OAuthError)
    await expect(resolveAccessToken()).rejects.toMatchObject({ code: 'not_logged_in' })
  })

  it('returns the stored access token when not expiring', async () => {
    mkdirSync(home, { recursive: true })
    const token = makeJwt(Math.floor(Date.now() / 1000) + 3600)
    writeFileSync(
      join(home, 'auth.json'),
      JSON.stringify({
        tokens: { access_token: token, refresh_token: 'refresh' },
        token_endpoint: 'https://auth.x.ai/oauth2/token',
      }),
    )
    const { resolveAccessToken } = await import('./credentials.ts')
    await expect(resolveAccessToken()).resolves.toBe(token)
  })
})

describe('loginSessions', () => {
  let home: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'grok-oauth-sess-'))
    process.env.GROK_OAUTH_PROXY_HOME = home
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  it('returns session_not_found for unknown session ids', async () => {
    const { pollLoginSession, clearLoginSessionsForTests } = await import(
      './loginSessions.ts'
    )
    clearLoginSessionsForTests()
    await expect(pollLoginSession('missing')).resolves.toMatchObject({
      status: 'error',
      code: 'session_not_found',
    })
  })

  it('starts a session and polls pending until success', async () => {
    const fetchMock = vi
      .fn()
      // discover
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token_endpoint: 'https://auth.x.ai/oauth2/token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      // device code
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_code: 'dc',
            user_code: 'ABCD-EFGH',
            verification_uri: 'https://auth.x.ai/device',
            verification_uri_complete: 'https://auth.x.ai/device?user_code=ABCD-EFGH',
            expires_in: 600,
            interval: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      // pending
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'authorization_pending' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      // success
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: makeJwt(Math.floor(Date.now() / 1000) + 3600),
            refresh_token: 'rt',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { startLoginSession, pollLoginSession, clearLoginSessionsForTests } =
      await import('./loginSessions.ts')
    clearLoginSessionsForTests()
    const start = await startLoginSession()
    expect(start.userCode).toBe('ABCD-EFGH')
    expect(start.sessionId).toBeTruthy()

    await expect(pollLoginSession(start.sessionId)).resolves.toMatchObject({
      status: 'pending',
    })
    await expect(pollLoginSession(start.sessionId)).resolves.toMatchObject({
      status: 'success',
    })

    const { loadAuthStore } = await import('./store.ts')
    expect(loadAuthStore()?.tokens.refresh_token).toBe('rt')
  })
})
