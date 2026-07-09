import { Hono } from 'hono'
import {
  getGrokStatus,
  GrokCliError,
  optimizePromptWithGrok,
} from '../grok/cli.ts'

export const optimizePromptRoutes = new Hono()

optimizePromptRoutes.get('/grok/status', async (c) => {
  const status = await getGrokStatus()
  return c.json({
    data: {
      available: status.available,
      version: status.version,
    },
  })
})

optimizePromptRoutes.post('/optimize-prompt', async (c) => {
  let body: {
    prompt?: unknown
    customInstructions?: unknown
    modelId?: unknown
  }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  const customInstructions =
    typeof body.customInstructions === 'string'
      ? body.customInstructions
      : undefined
  const modelId =
    typeof body.modelId === 'string' ? body.modelId : undefined

  try {
    const optimizedPrompt = await optimizePromptWithGrok({
      prompt: body.prompt.trim(),
      customInstructions,
      modelId,
    })
    return c.json({ data: { optimizedPrompt } })
  } catch (e) {
    if (e instanceof GrokCliError) {
      if (e.code === 'unavailable') {
        return c.json({ error: e.message }, 503)
      }
      if (e.code === 'timeout') {
        return c.json({ error: e.message }, 504)
      }
      return c.json({ error: e.message }, 500)
    }
    throw e
  }
})
