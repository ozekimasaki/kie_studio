import Electrobun, { BrowserWindow, Utils } from 'electrobun/bun'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import seedCatalog from '../../src/data/catalog.json' with { type: 'json' }
import {
  loadEmbeddedAgentApp,
  proxyAgentsToSidecar,
  type FlueNodeApplication,
} from './agentHost.ts'

// Electrobun main process entry (build.bun.entrypoint). Boots the shared Hono
// app inside Bun and points a native webview at the pre-built React UI.

// Persist the SQLite DB in the writable userData directory. This MUST be set
// before the server modules load, because server/db/open.ts reads
// STUDIO_DB_PATH at module-evaluation time.
const userData = Utils.paths.userData
mkdirSync(userData, { recursive: true })
process.env.STUDIO_DB_PATH = join(userData, 'studio.db')

// Flue conversation DB lives next to studio.db (parent of install `app/`).
// Uninstall must never delete this directory — same rule as studio.db.
process.env.FLUE_DB_PATH = join(userData, 'flue.db')

// Grok OAuth tokens (auth.json) — sibling of studio.db / flue.db.
process.env.GROK_OAUTH_PROXY_HOME = join(userData, 'grok-oauth')
mkdirSync(process.env.GROK_OAUTH_PROXY_HOME, { recursive: true })

// Per-boot token shared with the embedded (or sidecar) agent server for the
// loopback internal API. Must be set before the agent app loads providers.
process.env.STUDIO_AGENT_TOKEN = randomUUID()

// The catalog also lives in writable userData: the bundled source path is
// read-only on packaged builds (notably Linux, where startup sync could not
// persist its result and /api/models returned 503). Seed it once from the
// catalog snapshot bundled with the app so models are available immediately,
// even before — or without — a successful network sync.
const catalogPath = join(userData, 'catalog.json')
process.env.STUDIO_CATALOG_PATH = catalogPath
if (!existsSync(catalogPath)) {
  try {
    writeFileSync(catalogPath, `${JSON.stringify(seedCatalog, null, 2)}\n`, 'utf8')
  } catch (err) {
    console.warn('[catalog] failed to seed bundled catalog', err)
  }
}

// Import server modules only after STUDIO_DB_PATH is in place.
const { createApp } = await import('../../server/app.ts')
const { getDb, getDbPath } = await import('../../server/db/open.ts')
const { syncCatalog } = await import('../../server/catalog/sync.ts')
const { startBackfill } = await import('../../server/media/backfill.ts')
const { registerUpdateHandler } = await import('../../server/routes/update.ts')

const app = createApp()

let agentApp: FlueNodeApplication | null = null

function dispatch(req: Request): Response | Promise<Response> {
  const path = new URL(req.url).pathname
  if (path.startsWith('/agents')) {
    if (agentApp) return agentApp.fetch(req)
    return proxyAgentsToSidecar(req)
  }
  return app.fetch(req)
}

function startServer() {
  const maxAttempts = 20
  let port = 8787
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return Bun.serve({ fetch: dispatch, port, hostname: '127.0.0.1' })
    } catch {
      // Most likely EADDRINUSE; try the next port.
      port += 1
    }
  }
  throw new Error('KIE STUDIO: could not bind an API port (8787-8806 in use)')
}

const server = startServer()
// Agent tools call the studio internal API on this exact bind port.
process.env.STUDIO_API_BASE = `http://127.0.0.1:${server.port}`
console.log(`KIE STUDIO API listening on http://127.0.0.1:${server.port}`)

agentApp = await loadEmbeddedAgentApp(process.env)

let db: ReturnType<typeof getDb> | null = null
try {
  db = getDb()
  console.log(`[history] SQLite ready at ${getDbPath()}`)
} catch (err) {
  console.error('[history] failed to open SQLite', err)
}

// Startup catalog sync (non-blocking). Skips if catalog is < 12h old.
if (process.env.SYNC_MODELS_ON_START !== '0') {
  const force = process.env.SYNC_MODELS_FORCE === '1'
  void syncCatalog({ force, quiet: false }).catch((err) => {
    console.warn('[catalog] startup sync failed (using existing catalog):', err)
  })
}

// Backfill: download media for existing history items that lack localPath.
startBackfill()

// NOTE: Electrobun's native wrapper treats the ENTIRE views:// URL path
// (including ?query and #hash) as a literal file path. No parameters can be
// appended to the URL. The frontend uses the default API port (8787) or
// discovers it via the /api/health probe (see src/lib/api.ts).
new BrowserWindow({
  title: 'KIE STUDIO',
  url: 'views://mainview/index.html',
  frame: { width: 1280, height: 832 },
})

// Non-blocking, best-effort update check. Silently skipped when no baseUrl is
// configured (local builds) or when the updater API is unavailable.
// Downloads the update so it is applied on next startup.
async function checkForUpdatesQuietly() {
  try {
    const local = await Electrobun.Updater.getLocal()
    if (!local?.baseUrl) return
    const info = await Electrobun.Updater.checkForUpdate()
    if (info?.updateAvailable) {
      console.log(`[updater] update available: ${info.version ?? 'unknown'} — downloading…`)
      await Electrobun.Updater.downloadUpdate()
      console.log('[updater] download complete; will apply on next startup')
    }
  } catch (err) {
    console.warn('[updater] update check skipped', err)
  }
}

void checkForUpdatesQuietly()

// Register the /api/update/check handler so the frontend SettingsSheet can
// trigger an explicit update check + download from the UI.
registerUpdateHandler(async () => {
  const local = await Electrobun.Updater.getLocal()
  if (!local?.baseUrl) {
    return { available: false }
  }
  const info = await Electrobun.Updater.checkForUpdate()
  if (!info?.updateAvailable) {
    return { available: false, version: info?.version }
  }
  await Electrobun.Updater.downloadUpdate()
  return { available: true, version: info.version, downloaded: true }
})

process.on('exit', () => {
  try {
    agentApp?.closeSync()
  } catch {
    // ignore cleanup errors
  }
  try {
    db?.close()
  } catch {
    // ignore cleanup errors
  }
})
