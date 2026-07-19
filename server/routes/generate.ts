import { Hono } from 'hono'
import { assertPlainObject, assertSafeHttpsUrl } from '../kie/safe.ts'
import { KieApiError } from '../kie/client.ts'
import { getProviderAdapter } from '../kie/adapters/index.ts'
import type { Operation, Provider } from '../kie/types.ts'

export const generateRoutes = new Hono()

generateRoutes.post('/generate', async (c) => {
  let body: {
    model?: string
    input?: unknown
    callBackUrl?: string
    provider?: Provider
    operation?: Operation
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (!body.model || typeof body.model !== 'string') {
    return c.json({ error: 'model is required' }, 400)
  }
  try {
    assertPlainObject(body.input, 'input')
  } catch (e) {
    if (e instanceof KieApiError) {
      return c.json({ error: e.message }, 400)
    }
    throw e
  }

  let callBackUrl: string | undefined
  if (body.callBackUrl) {
    if (typeof body.callBackUrl !== 'string') {
      return c.json({ error: 'callBackUrl must be a string' }, 400)
    }
    try {
      assertSafeHttpsUrl(body.callBackUrl, 'callBackUrl')
      callBackUrl = body.callBackUrl
    } catch (e) {
      if (e instanceof KieApiError) {
        return c.json({ error: e.message }, 400)
      }
      throw e
    }
  }

  const provider = body.provider ?? 'market'
  const operation = body.operation ?? 'generate'
  const adapter = getProviderAdapter(provider)
  const created = await adapter.create({
    provider,
    operation,
    model: body.model,
    input: body.input,
    callBackUrl,
  })

  return c.json({ data: created })
})
