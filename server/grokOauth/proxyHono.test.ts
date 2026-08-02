// @vitest-environment node
import { createServer, type Server } from 'node:http'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

function makeJwt(exp: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`
}

describe('createGrokOauthProxyApp', () => {
  let home: string
  let upstream: Server
  let upstreamUrl: string
  let lastAuth: string | undefined
  let proxyBase: string

  beforeAll(async () => {
    home = mkdtempSync(join(tmpdir(), 'grok-oauth-proxy-'))
    process.env.GROK_OAUTH_PROXY_HOME = home
    mkdirSync(home, { recursive: true })
    writeFileSync(
      join(home, 'auth.json'),
      JSON.stringify({
        tokens: {
          access_token: makeJwt(Math.floor(Date.now() / 1000) + 3600),
          refresh_token: 'test-refresh',
        },
        token_endpoint: 'https://auth.x.ai/oauth2/token',
      }),
    )

    upstream = createServer((req, res) => {
      lastAuth = req.headers.authorization
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ echo: req.url, method: req.method }))
    })
    await new Promise<void>((resolve) =>
      upstream.listen(0, '127.0.0.1', () => resolve()),
    )
    const port = (upstream.address() as AddressInfo).port
    upstreamUrl = `http://127.0.0.1:${port}/v1`

    const { createGrokOauthProxyApp } = await import('./proxyHono.ts')
    const app = createGrokOauthProxyApp(upstreamUrl)
    // Bind via a tiny node server so we exercise fetch against the Hono app.
    const listener = createServer(async (req, res) => {
      const url = `http://127.0.0.1${req.url ?? '/'}`
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const request = new Request(url, {
        method: req.method,
        headers: req.headers as Record<string, string>,
        body:
          req.method === 'GET' || req.method === 'HEAD'
            ? undefined
            : Buffer.concat(chunks),
      })
      const response = await app.fetch(request)
      res.writeHead(response.status, Object.fromEntries(response.headers))
      const buf = Buffer.from(await response.arrayBuffer())
      res.end(buf)
    })
    await new Promise<void>((resolve) =>
      listener.listen(0, '127.0.0.1', () => resolve()),
    )
    proxyBase = `http://127.0.0.1:${(listener.address() as AddressInfo).port}`
    ;(globalThis as { __grokProxyListener?: Server }).__grokProxyListener = listener
  })

  afterAll(() => {
    upstream.close()
    ;(globalThis as { __grokProxyListener?: Server }).__grokProxyListener?.close()
    rmSync(home, { recursive: true, force: true })
  })

  it('healthz responds without hitting upstream', async () => {
    const res = await fetch(`${proxyBase}/healthz`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('forwards path and injects OAuth bearer', async () => {
    lastAuth = undefined
    const res = await fetch(`${proxyBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer dummy-client-key',
      },
      body: JSON.stringify({ model: 'grok-4.5' }),
    })
    expect(res.status).toBe(200)
    const payload = (await res.json()) as { echo: string; method: string }
    expect(payload.echo).toBe('/v1/chat/completions')
    expect(payload.method).toBe('POST')
    const auth = lastAuth ?? ''
    expect(auth.startsWith('Bearer eyJ')).toBe(true)
    expect(auth.includes('dummy-client-key')).toBe(false)
  })
})
