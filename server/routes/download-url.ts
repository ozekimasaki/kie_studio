import { Hono } from 'hono'
import { getDownloadUrl } from '../kie/common.ts'

export const downloadUrlRoutes = new Hono()

downloadUrlRoutes.post('/download-url', async (c) => {
  const body = await c.req.json<{ url?: string }>()
  if (!body.url) return c.json({ error: 'url is required' }, 400)
  const downloadUrl = await getDownloadUrl(body.url)
  return c.json({ data: { downloadUrl } })
})
