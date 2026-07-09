import { Hono } from 'hono'
import { uploadFileStream, uploadFromUrl } from '../kie/upload.ts'

export const uploadRoutes = new Hono()

uploadRoutes.post('/upload', async (c) => {
  const contentType = c.req.header('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await c.req.json<{
      fileUrl?: string
      uploadPath?: string
      fileName?: string
    }>()
    if (!body.fileUrl) {
      return c.json({ error: 'fileUrl is required' }, 400)
    }
    const result = await uploadFromUrl(body.fileUrl, {
      uploadPath: body.uploadPath,
      fileName: body.fileName,
    })
    return c.json({ data: result })
  }

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }
  const uploadPath = String(form.get('uploadPath') || 'kie-studio')
  const fileName = String(form.get('fileName') || file.name)

  const result = await uploadFileStream(file, { uploadPath, fileName })
  return c.json({ data: result })
})
