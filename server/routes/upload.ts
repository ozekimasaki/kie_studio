import { Hono } from 'hono'
import { uploadFileStream, uploadFromUrl } from '../kie/upload.ts'
import {
  assertSafeHttpsUrl,
  sanitizeFileName,
  sanitizeUploadPath,
} from '../kie/safe.ts'
import { KieApiError } from '../kie/client.ts'

export const uploadRoutes = new Hono()

uploadRoutes.post('/upload', async (c) => {
  const contentType = c.req.header('content-type') || ''

  if (contentType.includes('application/json')) {
    let body: {
      fileUrl?: string
      uploadPath?: string
      fileName?: string
    }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON' }, 400)
    }
    if (!body.fileUrl) {
      return c.json({ error: 'fileUrl is required' }, 400)
    }
    try {
      assertSafeHttpsUrl(body.fileUrl, 'fileUrl')
      const uploadPath = sanitizeUploadPath(body.uploadPath)
      const fileName = body.fileName
        ? sanitizeFileName(body.fileName, 'upload.bin')
        : undefined
      const result = await uploadFromUrl(body.fileUrl, {
        uploadPath,
        fileName,
      })
      return c.json({ data: result })
    } catch (e) {
      if (e instanceof KieApiError && e.status === 400) {
        return c.json({ error: e.message }, 400)
      }
      throw e
    }
  }

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return c.json({ error: 'file is required' }, 400)
  }

  try {
    const uploadPath = sanitizeUploadPath(
      String(form.get('uploadPath') || 'kie-studio'),
    )
    const fileName = sanitizeFileName(
      String(form.get('fileName') || file.name),
      file.name || 'upload.bin',
    )
    const result = await uploadFileStream(file, { uploadPath, fileName })
    return c.json({ data: result })
  } catch (e) {
    if (e instanceof KieApiError && e.status === 400) {
      return c.json({ error: e.message }, 400)
    }
    throw e
  }
})
