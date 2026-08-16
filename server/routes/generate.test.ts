// @vitest-environment node
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { describe, expect, it, vi } from 'vitest'
import { generateRoutes } from './generate.ts'

const create = vi.fn(async () => ({ taskId: 't-1' }))
const recordCreatedTask = vi.fn(async (_arg: unknown) => undefined)

vi.mock('../kie/adapters/index.ts', () => ({
  getProviderAdapter: () => ({ create }),
}))

vi.mock('../db/recordTask.ts', () => ({
  recordCreatedTask: (arg: unknown) => recordCreatedTask(arg),
}))

function makeApp() {
  const app = new Hono().route('/', generateRoutes)
  // 本番の createApp と同じく HTTPException を `{ error }` 形式へ変換する
  app.onError((err, c) =>
    err instanceof HTTPException
      ? c.json({ error: err.message }, err.status)
      : c.json({ error: 'unexpected' }, 500),
  )
  return app
}

function post(app: Hono, body: string) {
  return app.request('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('POST /generate validation', () => {
  it('returns 400 with { error } for malformed JSON', async () => {
    const response = await post(makeApp(), '{')
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: unknown }
    expect(typeof json.error).toBe('string')
  })

  it('returns 400 when model is missing', async () => {
    const response = await post(makeApp(), JSON.stringify({ input: {} }))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'model is required' })
  })

  it('returns 400 for an unknown provider', async () => {
    const response = await post(
      makeApp(),
      JSON.stringify({ model: 'm', input: {}, provider: 'bogus' }),
    )
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toContain('provider')
  })

  it('applies provider/operation defaults and forwards to the adapter', async () => {
    const response = await post(
      makeApp(),
      JSON.stringify({ model: 'test/model', input: { prompt: 'hi' } }),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { taskId: 't-1' } })
    expect(create).toHaveBeenCalledWith({
      provider: 'market',
      operation: 'generate',
      model: 'test/model',
      input: { prompt: 'hi' },
      callBackUrl: undefined,
    })
    expect(recordCreatedTask).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'market',
        operation: 'generate',
        model: 'test/model',
        created: { taskId: 't-1' },
      }),
    )
  })

  it('rejects a non-https callBackUrl', async () => {
    const response = await post(
      makeApp(),
      JSON.stringify({ model: 'm', input: {}, callBackUrl: 'http://example.com' }),
    )
    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: unknown }
    expect(typeof json.error).toBe('string')
  })
})
