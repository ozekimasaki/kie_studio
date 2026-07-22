import { Hono } from 'hono'
import { deleteSetting, getSetting, setSetting } from '../db/settings.ts'
import {
  KIE_API_KEY_SETTING,
  getStoredApiKey,
  hasUsableApiKey,
  maskApiKey,
} from '../settings/apiKey.ts'
import { getDb } from '../db/open.ts'

export const settingsRoutes = new Hono()

// Ensure DB is open when routes load
getDb()

const PLACEHOLDER = 'your_api_key_here'

settingsRoutes.get('/settings', (c) => {
  const key = getStoredApiKey()
  return c.json({
    data: {
      hasApiKey: hasUsableApiKey(),
      apiKeyMasked: key ? maskApiKey(key) : null,
      // Whether the effective key comes from the persisted store (vs env only).
      apiKeyFromStore: Boolean(getSetting(KIE_API_KEY_SETTING)),
    },
  })
})

settingsRoutes.put('/settings/api-key', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
  const raw = (body as { apiKey?: unknown })?.apiKey
  const apiKey = typeof raw === 'string' ? raw.trim() : ''
  if (!apiKey || apiKey === PLACEHOLDER) {
    return c.json({ error: 'apiKey is required' }, 400)
  }
  setSetting(KIE_API_KEY_SETTING, apiKey)
  return c.json({
    data: { hasApiKey: true, apiKeyMasked: maskApiKey(apiKey) },
  })
})

settingsRoutes.delete('/settings/api-key', (c) => {
  deleteSetting(KIE_API_KEY_SETTING)
  return c.json({ data: { hasApiKey: hasUsableApiKey() } })
})
