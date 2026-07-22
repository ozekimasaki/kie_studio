import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { uploadRoutes } from './routes/upload.ts'
import { generateRoutes } from './routes/generate.ts'
import { taskRoutes } from './routes/task.ts'
import { creditsRoutes } from './routes/credits.ts'
import { downloadUrlRoutes } from './routes/download-url.ts'
import { modelsRoutes } from './routes/models.ts'
import { optimizePromptRoutes } from './routes/optimize-prompt.ts'
import { historyRoutes } from './routes/history.ts'
import { sunoRoutes } from './routes/suno.ts'
import { archiveRoutes } from './routes/archive.ts'
import { settingsRoutes } from './routes/settings.ts'
import { KieApiError } from './kie/client.ts'
import { hasUsableApiKey } from './settings/apiKey.ts'

/**
 * Builds the Hono application shared by the dev Bun server (`server/index.ts`)
 * and the packaged Electrobun main process (`src/bun/index.ts`).
 */
export function createApp(): Hono {
  const app = new Hono()

  // Local-only API: allow localhost (Vite dev) and packaged webview origins
  // (`views://...` or a null origin). Credentials are never used, so
  // reflecting the request origin is safe.
  app.use(
    '*',
    cors({
      origin: (origin) => origin ?? '*',
    }),
  )

  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      hasKey: hasUsableApiKey(),
    }),
  )

  app.route('/api', uploadRoutes)
  app.route('/api', generateRoutes)
  app.route('/api', taskRoutes)
  app.route('/api', creditsRoutes)
  app.route('/api', downloadUrlRoutes)
  app.route('/api', modelsRoutes)
  app.route('/api', optimizePromptRoutes)
  app.route('/api', historyRoutes)
  app.route('/api', sunoRoutes)
  app.route('/api', archiveRoutes)
  app.route('/api', settingsRoutes)

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

  return app
}
