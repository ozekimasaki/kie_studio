// @vitest-environment node
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { KieApiError } from '../kie/client.ts'
import { sunoRoutes } from './suno.ts'

describe('Suno route validation', () => {
  it.each([
    '/suno/timestamped-lyrics',
    '/suno/style',
    '/suno/persona',
  ])('returns 400 for malformed JSON at %s', async (path) => {
    const app = new Hono().route('/', sunoRoutes)
    app.onError((error, c) => error instanceof KieApiError
      ? c.json({ error: error.message }, 400)
      : c.json({ error: 'unexpected' }, 500))
    const response = await app.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON' })
  })
})
