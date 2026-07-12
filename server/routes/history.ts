import { Hono } from 'hono'
import {
  historyCount,
  importHistoryItems,
  listHistory,
  migrateHistoryItems,
  replaceAllFromUnknown,
} from '../db/history.ts'
import { getDb } from '../db/open.ts'

export const historyRoutes = new Hono()

// Ensure DB is open when routes load
getDb()

historyRoutes.get('/history', (c) => {
  return c.json({ data: { items: listHistory(), count: historyCount() } })
})

historyRoutes.put('/history', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const items = (body as { items?: unknown })?.items
  try {
    const stored = replaceAllFromUnknown(items)
    return c.json({ data: { items: stored } })
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : 'Failed to save history' },
      400,
    )
  }
})

historyRoutes.post('/history/import', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const items = (body as { items?: unknown })?.items
  try {
    const stored = importHistoryItems(items)
    return c.json({ data: { items: stored } })
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : 'Failed to import history' },
      400,
    )
  }
})

historyRoutes.post('/history/migrate', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const items = (body as { items?: unknown })?.items
  try {
    const stored = migrateHistoryItems(items)
    return c.json({ data: { items: stored } })
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : 'Failed to migrate history' },
      400,
    )
  }
})
