import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from './api.ts'
import {
  fetchAgentHealth,
  fetchGrokOauthStatus,
  GROK_OAUTH_MISSING_MESSAGE,
  messageForGrokOauthError,
  startGrokOauthLogin,
} from './agentApi.ts'

function stubFetch(response: Response) {
  const mock = vi.fn(async () => response)
  vi.stubGlobal('fetch', mock)
  return mock
}

describe('agentApi.parse via Grok OAuth', () => {
  it('throws ApiClientError for plain-text 404 bodies (not JSON parse noise)', async () => {
    stubFetch(new Response('404 Not Found', { status: 404 }))
    const promise = fetchGrokOauthStatus()
    await expect(promise).rejects.toBeInstanceOf(ApiClientError)
    await expect(promise).rejects.toMatchObject({
      message: 'Request failed (404)',
      status: 404,
    })
  })

  it('maps 404 to the restart guidance message', async () => {
    stubFetch(new Response('404 Not Found', { status: 404 }))
    try {
      await startGrokOauthLogin()
      expect.unreachable()
    } catch (error) {
      expect(messageForGrokOauthError(error, 'fallback')).toBe(
        GROK_OAUTH_MISSING_MESSAGE,
      )
    }
  })

  it('returns data on success', async () => {
    stubFetch(
      new Response(
        JSON.stringify({
          data: { loggedIn: false, expiresAt: null, lastRefresh: null },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    await expect(fetchGrokOauthStatus()).resolves.toEqual({
      loggedIn: false,
      expiresAt: null,
      lastRefresh: null,
    })
  })
})

describe('fetchAgentHealth', () => {
  it('succeeds on { ok: true }', async () => {
    stubFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(fetchAgentHealth()).resolves.toEqual({ ok: true })
  })

  it('throws on 502 so the agent view can warn before send', async () => {
    stubFetch(new Response('bad gateway', { status: 502 }))
    await expect(fetchAgentHealth()).rejects.toMatchObject({ status: 502 })
  })
})
