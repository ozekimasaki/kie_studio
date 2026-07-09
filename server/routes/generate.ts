import { Hono } from 'hono'
import { createTask } from '../kie/market.ts'

export const generateRoutes = new Hono()

generateRoutes.post('/generate', async (c) => {
  const body = await c.req.json<{
    model?: string
    input?: Record<string, unknown>
    callBackUrl?: string
  }>()

  if (!body.model || typeof body.model !== 'string') {
    return c.json({ error: 'model is required' }, 400)
  }
  if (!body.input || typeof body.input !== 'object') {
    return c.json({ error: 'input is required' }, 400)
  }

  const taskId = await createTask({
    model: body.model,
    input: body.input,
    callBackUrl: body.callBackUrl,
  })

  return c.json({ data: { taskId } })
})
