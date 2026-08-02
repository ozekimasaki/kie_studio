import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export type FlueNodeApplication = {
  fetch: (request: Request, env?: unknown) => Response | Promise<Response>
  enterActivity: () => unknown
  pauseAdmissions: () => void
  stop: (timeoutMs?: number) => Promise<void>
  closeSync: () => void
}

/**
 * Candidate paths for the self-contained Flue embed chunk (`agent/dist/app.mjs`).
 * Electrobun main process CWD is typically `…/bin` with Resources at `../Resources`.
 */
export function resolveAgentAppPath(): string | null {
  const cwd = process.cwd()
  const candidates = [
    // Packaged ASAR unpack (useAsar + asarUnpack: agent-server/**)
    join(cwd, '../Resources/app.asar.unpacked/agent-server/app.mjs'),
    // Packaged without ASAR / before pack, or flat Resources/app layout
    join(cwd, '../Resources/app/agent-server/app.mjs'),
    join(cwd, '../Resources/agent-server/app.mjs'),
    // Windows flat build trees sometimes keep `app/` next to the launcher
    join(cwd, '../app/agent-server/app.mjs'),
    join(cwd, 'agent-server/app.mjs'),
    // Repo-root / desktop:dev with a prior `npm run agent:build`
    join(cwd, 'agent/dist/app.mjs'),
    join(cwd, '../agent/dist/app.mjs'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export async function loadEmbeddedAgentApp(
  env: NodeJS.ProcessEnv = process.env,
): Promise<FlueNodeApplication | null> {
  const appPath = resolveAgentAppPath()
  if (!appPath) {
    console.warn(
      '[agent] embedded Flue app.mjs not found; /agents will proxy to 127.0.0.1:8789 when available',
    )
    return null
  }

  try {
    const mod = (await import(pathToFileURL(appPath).href)) as {
      loadFlueNodeApplication?: (opts?: {
        env?: NodeJS.ProcessEnv
        local?: boolean
      }) => Promise<FlueNodeApplication>
    }
    if (typeof mod.loadFlueNodeApplication !== 'function') {
      console.warn(`[agent] ${appPath} has no loadFlueNodeApplication export`)
      return null
    }
    const app = await mod.loadFlueNodeApplication({ env, local: true })
    console.log(`[agent] embedded Flue loaded from ${appPath}`)
    return app
  } catch (err) {
    console.warn('[agent] failed to load embedded Flue app', err)
    return null
  }
}

const AGENT_SIDECAR = 'http://127.0.0.1:8789'

/** Dev fallback when the embed chunk is missing: forward to the Flue vite sidecar. */
export async function proxyAgentsToSidecar(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const target = `${AGENT_SIDECAR}${url.pathname}${url.search}`
  try {
    const headers = new Headers(req.headers)
    headers.delete('host')
    const init: RequestInit = {
      method: req.method,
      headers,
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.arrayBuffer()
    }
    return await fetch(target, init)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'agent sidecar unreachable'
    return Response.json(
      {
        error: `agent server unavailable (${AGENT_SIDECAR}): ${message}`,
      },
      { status: 502 },
    )
  }
}
