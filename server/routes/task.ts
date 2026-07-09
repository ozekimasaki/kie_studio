import { Hono } from 'hono'
import { getTaskDetail } from '../kie/market.ts'

export const taskRoutes = new Hono()

taskRoutes.get('/task', async (c) => {
  const taskId = c.req.query('taskId')
  if (!taskId) return c.json({ error: 'taskId is required' }, 400)
  const task = await getTaskDetail(taskId)
  return c.json({ data: task })
})
