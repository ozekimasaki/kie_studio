import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  AGENT_UNAVAILABLE_DEV_HINT,
  AGENT_UNAVAILABLE_MESSAGE,
  agentUnavailableBody,
} from '../lib/agentUnavailable.ts'
import { extractAsarPrefix } from './agentAsar.ts'

export type FlueNodeApplication = {
  fetch: (request: Request, env?: unknown) => Response | Promise<Response>
  enterActivity: () => unknown
  pauseAdmissions: () => void
  stop: (timeoutMs?: number) => Promise<void>
  closeSync: () => void
}

const AGENT_APP_RELATIVE = [
  // postBuild copies agent-server next to app.asar (asarUnpack is a no-op:
  // Electrobun deletes Resources/app after packing).
  '../Resources/agent-server/app.mjs',
  'Resources/agent-server/app.mjs',
  // Packaged ASAR unpack (useAsar + asarUnpack) — kept for Electrobun if it lands
  '../Resources/app.asar.unpacked/agent-server/app.mjs',
  '../Resources/app/agent-server/app.mjs',
  // Windows flat build trees sometimes keep `app/` next to the launcher
  '../app/agent-server/app.mjs',
  'agent-server/app.mjs',
  // Repo-root / desktop:dev with a prior `npm run agent:build`
  'agent/dist/app.mjs',
  '../agent/dist/app.mjs',
] as const

const ASAR_RELATIVE = ['../Resources/app.asar', 'Resources/app.asar'] as const

export function defaultAgentSearchRoots(): string[] {
  const roots: string[] = []
  const add = (value: string | undefined) => {
    if (!value) return
    if (!roots.includes(value)) roots.push(value)
  }
  add(process.cwd())
  try {
    add(dirname(process.execPath))
  } catch {
    // ignore
  }
  try {
    if (process.argv0) add(dirname(process.argv0))
  } catch {
    // ignore
  }
  try {
    add(dirname(fileURLToPath(import.meta.url)))
  } catch {
    // ignore
  }
  return roots
}

export function agentAppCandidates(roots: string[]): string[] {
  const out: string[] = []
  for (const root of roots) {
    for (const rel of AGENT_APP_RELATIVE) {
      const path = join(root, rel)
      if (!out.includes(path)) out.push(path)
    }
  }
  return out
}

export function asarCandidates(roots: string[]): string[] {
  const out: string[] = []
  for (const root of roots) {
    for (const rel of ASAR_RELATIVE) {
      const path = join(root, rel)
      if (!out.includes(path)) out.push(path)
    }
  }
  return out
}

/**
 * Candidate paths for the self-contained Flue embed chunk (`agent/dist/app.mjs`).
 * Electrobun main process CWD is typically `…/bin` with Resources at `../Resources`.
 */
export function resolveAgentAppPath(
  exists: (path: string) => boolean = existsSync,
  roots: string[] = defaultAgentSearchRoots(),
): string | null {
  for (const path of agentAppCandidates(roots)) {
    if (exists(path)) return path
  }
  return null
}

export function resolveAppAsarPath(
  exists: (path: string) => boolean = existsSync,
  roots: string[] = defaultAgentSearchRoots(),
): string | null {
  for (const path of asarCandidates(roots)) {
    if (exists(path)) return path
  }
  return null
}

export function extractEmbeddedAgentFromAsar(
  asarPath: string,
  destDir: string,
  readFile: (path: string) => Buffer = readFileSync,
): string {
  const buf = readFile(asarPath)
  extractAsarPrefix(buf, 'agent-server', destDir, { skipSuffixes: ['.map'] })
  return join(destDir, 'app.mjs')
}

export type LoadEmbeddedAgentOptions = {
  /** Writable fallback when Resources/ is read-only (userData/agent-server). */
  extractDir?: string
}

export async function loadEmbeddedAgentApp(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadEmbeddedAgentOptions = {},
): Promise<FlueNodeApplication | null> {
  let appPath = resolveAgentAppPath()
  if (!appPath) {
    const asarPath = resolveAppAsarPath()
    const destDir = options.extractDir
    if (asarPath && destDir) {
      try {
        const extracted = extractEmbeddedAgentFromAsar(asarPath, destDir)
        if (existsSync(extracted)) {
          console.log(`[agent] extracted Flue from ${asarPath} -> ${destDir}`)
          appPath = extracted
        }
      } catch (err) {
        console.warn('[agent] failed to extract agent-server from app.asar', err)
      }
    }
  }
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

export const AGENT_SIDECAR = 'http://127.0.0.1:8789'

const DEFAULT_RETRY_DELAYS_MS = [100, 200, 400]

function agentUnavailableResponse(details: string, packaged: boolean): Response {
  const message = packaged
    ? AGENT_UNAVAILABLE_MESSAGE
    : `${AGENT_UNAVAILABLE_MESSAGE} ${AGENT_UNAVAILABLE_DEV_HINT}`
  return Response.json(agentUnavailableBody(details, message), { status: 502 })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type ProxyAgentsOptions = {
  /** Empty skips retries (tests). Default covers sidecar boot races. */
  retryDelaysMs?: number[]
  fetchImpl?: typeof fetch
  packaged?: boolean
}

/** Dev fallback when the embed chunk is missing: forward to the Flue vite sidecar. */
export async function proxyAgentsToSidecar(
  req: Request,
  options: ProxyAgentsOptions = {},
): Promise<Response> {
  const packaged = options.packaged ?? Boolean(resolveAppAsarPath())
  if (packaged) {
    return agentUnavailableResponse(
      'embedded Flue app.mjs missing from the install (asarUnpack is ignored by Electrobun)',
      true,
    )
  }

  const url = new URL(req.url)
  const target = `${AGENT_SIDECAR}${url.pathname}${url.search}`
  const headers = new Headers(req.headers)
  headers.delete('host')
  const init: RequestInit = {
    method: req.method,
    headers,
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer()
  }

  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  const fetchImpl = options.fetchImpl ?? fetch
  const attempts = retryDelaysMs.length + 1
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchImpl(target, init)
    } catch (err) {
      lastError = err
      const delay = retryDelaysMs[attempt]
      if (delay !== undefined) await sleep(delay)
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : 'agent sidecar unreachable'
  return agentUnavailableResponse(`${AGENT_SIDECAR}: ${message}`, false)
}
