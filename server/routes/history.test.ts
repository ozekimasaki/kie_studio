// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { beforeEach, describe, expect, it } from 'vitest'

process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-studio-history-routes-')),
  'studio.db',
)

const { historyRoutes } = await import('./history.ts')
const { replaceAllFromUnknown } = await import('../db/history.ts')

function makeApp() {
  const app = new Hono().route('/api', historyRoutes)
  app.onError((err, c) =>
    err instanceof HTTPException
      ? c.json({ error: err.message }, err.status)
      : c.json({ error: 'unexpected' }, 500),
  )
  return app
}

describe('history routes', () => {
  beforeEach(() => {
    replaceAllFromUnknown([])
  })

  it('PUT upserts without deleting unknown rows', async () => {
    replaceAllFromUnknown([
      {
        taskId: 'cli-1',
        model: 'cli',
        category: 'image',
        state: 'success',
        createdAt: 1,
      },
    ])
    const app = makeApp()
    const response = await app.request('/api/history', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            taskId: 'ui-1',
            model: 'ui',
            category: 'image',
            state: 'waiting',
            createdAt: 2,
          },
        ],
      }),
    })
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { items: { taskId: string }[] }
    }
    expect(json.data.items.map((item) => item.taskId).sort()).toEqual([
      'cli-1',
      'ui-1',
    ])
  })

  it('DELETE removes one item and 404s when missing', async () => {
    replaceAllFromUnknown([
      {
        taskId: 'gone',
        model: 'm',
        category: 'image',
        state: 'success',
        createdAt: 1,
      },
    ])
    const app = makeApp()
    const deleted = await app.request('/api/history/gone', { method: 'DELETE' })
    expect(deleted.status).toBe(200)
    const missing = await app.request('/api/history/gone', { method: 'DELETE' })
    expect(missing.status).toBe(404)
  })

  it('POST /history/clear-unpinned keeps pinned rows', async () => {
    replaceAllFromUnknown([
      {
        taskId: 'pin',
        model: 'm',
        category: 'image',
        state: 'success',
        createdAt: 1,
        pinned: true,
      },
      {
        taskId: 'free',
        model: 'm',
        category: 'image',
        state: 'success',
        createdAt: 2,
      },
    ])
    const app = makeApp()
    const response = await app.request('/api/history/clear-unpinned', {
      method: 'POST',
    })
    expect(response.status).toBe(200)
    const json = (await response.json()) as {
      data: { items: { taskId: string }[] }
    }
    expect(json.data.items.map((item) => item.taskId)).toEqual(['pin'])
  })
})
