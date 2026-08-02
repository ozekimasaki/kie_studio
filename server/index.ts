import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createApp } from './app.ts'
import { syncCatalog } from './catalog/sync.ts'
import { getDb, getDbPath } from './db/open.ts'
import { startBackfill } from './media/backfill.ts'

// Bun auto-loads `.env` from the project root, so no explicit dotenv step is
// needed here. This entry is intentionally thin: it starts the shared Hono app
// (see `server/app.ts`) via `Bun.serve` for local development. The packaged
// desktop build boots the same app from `src/bun/index.ts`.

if (!process.env.GROK_OAUTH_PROXY_HOME?.trim()) {
  const home = join(process.cwd(), 'data', 'grok-oauth')
  mkdirSync(home, { recursive: true })
  process.env.GROK_OAUTH_PROXY_HOME = home
}

const app = createApp()
const port = Number(process.env.PORT || 8787)

const server = Bun.serve({
  fetch: app.fetch,
  port,
  hostname: '127.0.0.1',
})

process.env.STUDIO_API_BASE = `http://127.0.0.1:${server.port}`

console.log(`KIE STUDIO API listening on http://127.0.0.1:${server.port}`)

try {
  getDb()
  console.log(`[history] SQLite ready at ${getDbPath()}`)
} catch (err) {
  console.error('[history] failed to open SQLite', err)
}

// Startup catalog sync (non-blocking). Skips if catalog is < 12h old.
// Set SYNC_MODELS_ON_START=0 to disable, or SYNC_MODELS_FORCE=1 to always refresh.
const syncEnabled = process.env.SYNC_MODELS_ON_START !== '0'
if (syncEnabled) {
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
} else {
  console.log('[catalog] startup sync disabled (SYNC_MODELS_ON_START=0)')
}

// Backfill: download media for existing history items that lack localPath.
startBackfill()
