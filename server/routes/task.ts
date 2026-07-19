import { Hono } from 'hono'
import { getProviderAdapter } from '../kie/adapters/index.ts'
import type { Operation, Provider } from '../kie/types.ts'

export const taskRoutes = new Hono()

taskRoutes.get('/task', async (c) => {
  const taskId = c.req.query('taskId')
  if (!taskId) return c.json({ error: 'taskId is required' }, 400)
  const provider = (c.req.query('provider') ?? 'market') as Provider
  const operation = (c.req.query('operation') ?? 'generate') as Operation
  const task = await getProviderAdapter(provider).getTask(taskId, operation)
  return c.json({ data: task })
})
