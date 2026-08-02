// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { grokOauthRoutes } from './grokOauth.ts'
import { clearLoginSessionsForTests } from '../grokOauth/loginSessions.ts'

function makeJwt(exp: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`
}

describe('grokOauth routes', () => {
  let home: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'grok-oauth-routes-'))
    process.env.GROK_OAUTH_PROXY_HOME = home
    clearLoginSessionsForTests()
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  function app() {
    return new Hono().route('/api', grokOauthRoutes)
  }

  it('GET status reports loggedOut when no store', async () => {
    const res = await app().request('/api/settings/grok-oauth')
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: { loggedIn: boolean } }
    expect(json.data.loggedIn).toBe(false)
  })

  it('GET status reports loggedIn when auth.json exists', async () => {
    mkdirSync(home, { recursive: true })
    writeFileSync(
      join(home, 'auth.json'),
      JSON.stringify({
        tokens: {
          access_token: makeJwt(Math.floor(Date.now() / 1000) + 3600),
          refresh_token: 'rt',
        },
        last_refresh: '2026-01-01T00:00:00.000Z',
      }),
    )
    const res = await app().request('/api/settings/grok-oauth')
    const json = (await res.json()) as {
      data: { loggedIn: boolean; lastRefresh: string | null }
    }
    expect(json.data.loggedIn).toBe(true)
    expect(json.data.lastRefresh).toBe('2026-01-01T00:00:00.000Z')
  })

  it('logout clears the store', async () => {
    mkdirSync(home, { recursive: true })
    writeFileSync(
      join(home, 'auth.json'),
      JSON.stringify({
        tokens: { access_token: 'a', refresh_token: 'rt' },
      }),
    )
    const res = await app().request('/api/settings/grok-oauth/logout', {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const status = await app().request('/api/settings/grok-oauth')
    const json = (await status.json()) as { data: { loggedIn: boolean } }
    expect(json.data.loggedIn).toBe(false)
  })

  it('login start returns device challenge', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ token_endpoint: 'https://auth.x.ai/oauth2/token' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              device_code: 'dc',
              user_code: 'CODE-1',
              verification_uri: 'https://auth.x.ai/device',
              expires_in: 300,
              interval: 2,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    )
    const res = await app().request('/api/settings/grok-oauth/login/start', {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      data: { sessionId: string; userCode: string; interval: number }
    }
    expect(json.data.userCode).toBe('CODE-1')
    expect(json.data.sessionId).toBeTruthy()
    expect(json.data.interval).toBe(2)
  })
})
