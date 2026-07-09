import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { uploadRoutes } from './routes/upload.ts'
import { generateRoutes } from './routes/generate.ts'
import { taskRoutes } from './routes/task.ts'
import { creditsRoutes } from './routes/credits.ts'
import { downloadUrlRoutes } from './routes/download-url.ts'
import { modelsRoutes } from './routes/models.ts'
import { optimizePromptRoutes } from './routes/optimize-prompt.ts'
import { KieApiError } from './kie/client.ts'
import { syncCatalog } from './catalog/sync.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

const app = new Hono()

app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
)

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    hasKey: Boolean(
      process.env.KIE_API_KEY && process.env.KIE_API_KEY !== 'your_api_key_here',
    ),
  }),
)

app.route('/api', uploadRoutes)
app.route('/api', generateRoutes)
app.route('/api', taskRoutes)
app.route('/api', creditsRoutes)
app.route('/api', downloadUrlRoutes)
app.route('/api', modelsRoutes)
app.route('/api', optimizePromptRoutes)

app.onError((err, c) => {
  if (err instanceof KieApiError) {
    console.error('[kie]', err.message, { status: err.status, code: err.code })
    const status =
      err.status >= 400 && err.status < 600
        ? (err.status as 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503)
        : 500
    return c.json({ error: err.message, code: err.code }, status)
  }
  console.error(err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

const port = Number(process.env.PORT || 8787)

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`KIE STUDIO API listening on http://127.0.0.1:${info.port}`)

  // Startup catalog sync (non-blocking). Skips if catalog is < 12h old.
  // Set SYNC_MODELS_ON_START=0 to disable, or SYNC_MODELS_FORCE=1 to always refresh.
  const syncEnabled = process.env.SYNC_MODELS_ON_START !== '0'
  if (!syncEnabled) {
    console.log('[catalog] startup sync disabled (SYNC_MODELS_ON_START=0)')
    return
  }

  const force = process.env.SYNC_MODELS_FORCE === '1'
  void syncCatalog({ force, quiet: false })
    .then((result) => {
      if (result.skipped) {
        console.log(`[catalog] ${result.reason}`)
      } else {
        console.log(
          `[catalog] startup sync done (${result.catalog?.models.length ?? 0} models)`,
        )
      }
    })
    .catch((err) => {
      console.warn('[catalog] startup sync failed (using existing catalog):', err)
    })
})
