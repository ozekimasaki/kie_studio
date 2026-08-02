/**
 * Adapted from grok-oauth-proxy (MIT)
 * https://github.com/ozekimasaki/grok-oauth-proxy
 *
 * OpenAI-compatible forwarder that injects the OAuth access token.
 */

import { Hono } from 'hono'
import { DEFAULT_XAI_BASE_URL } from './constants.ts'
import { resolveAccessToken } from './credentials.ts'
import { OAuthError } from './oauth.ts'

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'authorization',
])

function buildUpstreamHeaders(req: Request, accessToken: string): Headers {
  const headers = new Headers()
  req.headers.forEach((value, name) => {
    if (HOP_BY_HOP.has(name.toLowerCase())) return
    headers.set(name, value)
  })
  headers.set('Authorization', `Bearer ${accessToken}`)
  return headers
}

function jsonError(message: string, code: string, status: number): Response {
  return Response.json(
    { error: { message, type: 'grok_oauth_proxy_error', code } },
    { status },
  )
}

async function forward(
  req: Request,
  upstreamPath: string,
  baseUrl: string,
): Promise<Response> {
  const upstreamUrl = `${baseUrl.replace(/\/$/, '')}${upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`}`
  const method = req.method
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer()

  let response: Response | undefined
  for (const forceRefresh of [false, true]) {
    const accessToken = await resolveAccessToken({ forceRefresh })
    response = await fetch(upstreamUrl, {
      method,
      headers: buildUpstreamHeaders(req, accessToken),
      body: body && body.byteLength > 0 ? body : undefined,
    })
    if (response.status !== 401) break
  }
  if (!response) throw new Error('unreachable')

  const responseHeaders = new Headers()
  response.headers.forEach((value, name) => {
    const lower = name.toLowerCase()
    if (
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'content-encoding'
    ) {
      return
    }
    responseHeaders.set(name, value)
  })
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export function createGrokOauthProxyApp(
  baseUrl: string = DEFAULT_XAI_BASE_URL,
): Hono {
  const app = new Hono()

  app.get('/healthz', (c) => c.json({ ok: true }))

  app.all('/*', async (c) => {
    const path = c.req.path
    try {
      return await forward(c.req.raw, path, baseUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof OAuthError ? error.code : 'proxy_error'
      const status =
        error instanceof OAuthError && error.reloginRequired ? 401 : 502
      return jsonError(message, code, status)
    }
  })

  return app
}
