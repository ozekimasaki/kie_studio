import { Hono } from 'hono'
import { z } from 'zod'
import { clearAuthStore } from '../grokOauth/store.ts'
import {
  cancelLoginSession,
  pollLoginSession,
  startLoginSession,
} from '../grokOauth/loginSessions.ts'
import { createGrokOauthProxyApp } from '../grokOauth/proxyHono.ts'
import { getGrokOauthStatus } from '../grokOauth/systemEndpoint.ts'
import { OAuthError } from '../grokOauth/oauth.ts'
import { validateJson } from './validation.ts'

export const grokOauthRoutes = new Hono()

grokOauthRoutes.get('/settings/grok-oauth', (c) => {
  return c.json({ data: getGrokOauthStatus() })
})

grokOauthRoutes.post('/settings/grok-oauth/login/start', async (c) => {
  try {
    const started = await startLoginSession()
    return c.json({ data: started })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login start failed'
    const code = error instanceof OAuthError ? error.code : 'login_start_failed'
    return c.json({ error: message, code }, 502)
  }
})

const pollBodySchema = z.object({
  sessionId: z.string({ error: 'sessionId is required' }).trim().min(1),
})

grokOauthRoutes.post(
  '/settings/grok-oauth/login/poll',
  validateJson(pollBodySchema),
  async (c) => {
    const { sessionId } = c.req.valid('json')
    const result = await pollLoginSession(sessionId)
    if (result.status === 'error') {
      return c.json(
        { data: result },
        result.code === 'session_not_found' ? 404 : 400,
      )
    }
    return c.json({ data: result })
  },
)

const cancelBodySchema = z.object({
  sessionId: z.string().trim().min(1).optional(),
})

grokOauthRoutes.post(
  '/settings/grok-oauth/login/cancel',
  validateJson(cancelBodySchema),
  (c) => {
    const { sessionId } = c.req.valid('json')
    if (sessionId) cancelLoginSession(sessionId)
    return c.json({ data: { ok: true } })
  },
)

grokOauthRoutes.post('/settings/grok-oauth/logout', (c) => {
  const cleared = clearAuthStore()
  return c.json({ data: { loggedOut: cleared } })
})

grokOauthRoutes.route('/grok-oauth/v1', createGrokOauthProxyApp())
