import { Hono } from 'hono'
import { uploadFileStream, uploadFromUrl } from '../kie/upload.ts'
import {
  assertSafeHttpsUrl,
  sanitizeFileName,
  sanitizeUploadPath,
} from '../kie/safe.ts'
import { KieApiError } from '../kie/client.ts'
import { listAudioAssets, removeAudioAsset, saveAudioAsset } from '../db/audio-assets.ts'

export const uploadRoutes = new Hono()

function expiryTimestamp(value?: string): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function looksLikeAudio(name: string): boolean {
  return /\.(?:mp3|wav|m4a|aac|ogg|flac|opus)(?:$|\?)/i.test(name)
}

uploadRoutes.get('/audio-assets', (c) =>
  c.json({ data: { items: listAudioAssets() } }),
)

uploadRoutes.delete('/audio-assets/:id', (c) => {
  const removed = removeAudioAsset(c.req.param('id'))
  return removed
    ? c.json({ data: { removed: true } })
    : c.json({ error: 'Audio asset not found' }, 404)
})

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
      const originalFileName = body.fileName ?? new URL(body.fileUrl).pathname.split('/').pop()
      if (originalFileName && looksLikeAudio(originalFileName)) {
        saveAudioAsset({
          url: result.fileUrl,
          name: originalFileName,
        })
      }
      return c.json({
        data: {
          ...result,
          originalFileName,
        },
      })
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
    if (file.type.startsWith('audio/') || looksLikeAudio(file.name)) {
      saveAudioAsset({
        url: result.fileUrl,
        name: file.name,
        expiresAt: expiryTimestamp(result.expiresAt),
      })
    }
    return c.json({ data: { ...result, originalFileName: file.name } })
  } catch (e) {
    if (e instanceof KieApiError && e.status === 400) {
      return c.json({ error: e.message }, 400)
    }
    throw e
  }
})
