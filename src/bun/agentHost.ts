import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
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

type AgentAppModule = {
  loadFlueNodeApplication?: (opts?: {
    env?: NodeJS.ProcessEnv
    local?: boolean
  }) => Promise<FlueNodeApplication>
}

/** Matches `electrobun.config.ts` `app.identifier`. */
export const STUDIO_APP_IDENTIFIER = 'ai.kie.studio'
export const STUDIO_CHANNELS = ['canary', 'stable', 'dev'] as const

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

function addUnique(out: string[], value: string | undefined): void {
  if (!value) return
  if (!out.includes(value)) out.push(value)
}

export function defaultAgentSearchRoots(): string[] {
  const roots: string[] = []
  addUnique(roots, process.cwd())
  try {
    addUnique(roots, dirname(process.execPath))
  } catch {
    // ignore
  }
  try {
    if (process.argv0) addUnique(roots, dirname(process.argv0))
  } catch {
    // ignore
  }
  try {
    addUnique(roots, dirname(fileURLToPath(import.meta.url)))
  } catch {
    // ignore
  }
  return roots
}

/**
 * Electrobun Windows loads `bun/index.js` as a Worker from `%TEMP%/electrobun-*.js`.
 * cwd / argv0 / import.meta.url then all point at Temp, so `../Resources/agent-server`
 * misses the install. Probe the known per-user layout instead.
 */
export function knownInstallBinDirs(
  env: NodeJS.ProcessEnv = process.env,
  userData?: string,
): string[] {
  const out: string[] = []
  if (userData) {
    addUnique(out, join(userData, 'app', 'bin'))
    addUnique(out, join(userData, 'bin'))
  }
  const localAppData = env.LOCALAPPDATA
  if (localAppData) {
    for (const channel of STUDIO_CHANNELS) {
      addUnique(out, join(localAppData, STUDIO_APP_IDENTIFIER, channel, 'app', 'bin'))
    }
  }
  const home = env.HOME
  const xdg = env.XDG_DATA_HOME ?? (home ? join(home, '.local', 'share') : undefined)
  if (xdg) {
    for (const channel of STUDIO_CHANNELS) {
      addUnique(out, join(xdg, STUDIO_APP_IDENTIFIER, channel, 'app', 'bin'))
    }
  }
  for (const channel of STUDIO_CHANNELS) {
    addUnique(out, join('/opt/kie-studio', channel, 'bin'))
  }
  return out
}

function looksLikeResourcesDir(dir: string, exists: (path: string) => boolean): boolean {
  return (
    exists(join(dir, 'agent-server', 'app.mjs')) ||
    exists(join(dir, 'app.asar')) ||
    exists(join(dir, 'version.json'))
  )
}

export function discoverResourcesDirs(
  roots: string[],
  env: NodeJS.ProcessEnv = process.env,
  userData?: string,
  exists: (path: string) => boolean = existsSync,
): string[] {
  const out: string[] = []
  const consider = (dir: string) => {
    const resources = join(dir, 'Resources')
    if (looksLikeResourcesDir(resources, exists)) addUnique(out, resources)
    const nested = join(dir, 'app', 'Resources')
    if (looksLikeResourcesDir(nested, exists)) addUnique(out, nested)
  }
  for (const root of [...roots, ...knownInstallBinDirs(env, userData)]) {
    let dir = root
    for (let depth = 0; depth < 8; depth++) {
      consider(dir)
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  return out
}

export function agentAppCandidates(roots: string[]): string[] {
  const out: string[] = []
  for (const root of roots) {
    for (const rel of AGENT_APP_RELATIVE) {
      addUnique(out, join(root, rel))
    }
  }
  return out
}

export function asarCandidates(roots: string[]): string[] {
  const out: string[] = []
  for (const root of roots) {
    for (const rel of ASAR_RELATIVE) {
      addUnique(out, join(root, rel))
    }
  }
  return out
}

export function packagedAgentAppPaths(
  roots: string[],
  env: NodeJS.ProcessEnv = process.env,
  userData?: string,
  exists: (path: string) => boolean = existsSync,
): string[] {
  const out: string[] = []
  for (const resources of discoverResourcesDirs(roots, env, userData, exists)) {
    addUnique(out, join(resources, 'agent-server', 'app.mjs'))
  }
  if (userData) addUnique(out, join(userData, 'agent-server', 'app.mjs'))
  return out
}

export function packagedAsarPaths(
  roots: string[],
  env: NodeJS.ProcessEnv = process.env,
  userData?: string,
  exists: (path: string) => boolean = existsSync,
): string[] {
  const out: string[] = []
  for (const resources of discoverResourcesDirs(roots, env, userData, exists)) {
    addUnique(out, join(resources, 'app.asar'))
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
  extraPaths: string[] = [],
): string | null {
  for (const path of [...agentAppCandidates(roots), ...extraPaths]) {
    if (exists(path)) return path
  }
  return null
}

export function resolveAppAsarPath(
  exists: (path: string) => boolean = existsSync,
  roots: string[] = defaultAgentSearchRoots(),
  extraPaths: string[] = [],
): string | null {
  for (const path of [...asarCandidates(roots), ...extraPaths]) {
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

/**
 * Electrobun itself reads `../Resources/version.json` from cwd. If the Worker
 * started in Temp, identifier/channel (and therefore userData) are empty.
 * Move into the install `bin/` when we can see it — skip repo `desktop:dev`.
 */
export function ensureInstallWorkingDirectory(options: {
  exists?: (path: string) => boolean
  env?: NodeJS.ProcessEnv
  chdir?: (dir: string) => void
  cwd?: () => string
} = {}): string | null {
  const exists = options.exists ?? existsSync
  const env = options.env ?? process.env
  const chdir = options.chdir ?? ((dir: string) => process.chdir(dir))
  const here = (options.cwd ?? (() => process.cwd()))()
  if (exists(join(here, '../Resources/version.json'))) return here
  if (exists(join(here, 'electrobun.config.ts'))) return here
  if (exists(join(here, 'src/bun/index.ts'))) return here
  if (exists(join(here, 'agent/dist/app.mjs'))) return here
  if (exists(join(here, 'Resources/version.json')) && exists(join(here, 'bin'))) {
    const bin = join(here, 'bin')
    chdir(bin)
    return bin
  }
  for (const root of [...defaultAgentSearchRoots(), ...knownInstallBinDirs(env)]) {
    if (exists(join(root, '../Resources/version.json'))) {
      if (root !== here) chdir(root)
      return root
    }
    if (exists(join(root, 'Resources/version.json')) && exists(join(root, 'bin'))) {
      const bin = join(root, 'bin')
      chdir(bin)
      return bin
    }
  }
  return null
}

export type LoadEmbeddedAgentOptions = {
  /** Writable fallback when Resources/ is read-only (userData/agent-server). */
  extractDir?: string
  userData?: string
}

let lastEmbeddedAgentError: string | null = null

export function getLastEmbeddedAgentError(): string | null {
  return lastEmbeddedAgentError
}

function rememberAgentError(message: string, err?: unknown): void {
  const extra =
    err instanceof Error ? err.message : err !== undefined ? String(err) : ''
  lastEmbeddedAgentError = extra ? `${message}: ${extra}` : message
  if (err !== undefined) console.warn('[agent]', message, err)
  else console.warn('[agent]', message)
}

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function importAgentAppModule(appPath: string): Promise<AgentAppModule> {
  const href = pathToFileURL(appPath).href
  try {
    return (await import(href)) as AgentAppModule
  } catch (fileUrlErr) {
    try {
      return (await import(appPath)) as AgentAppModule
    } catch {
      throw fileUrlErr
    }
  }
}

function copyAgentServerTo(srcApp: string, destDir: string): string {
  const srcDir = dirname(srcApp)
  mkdirSync(destDir, { recursive: true })
  cpSync(srcDir, destDir, { recursive: true })
  return join(destDir, 'app.mjs')
}

async function bootAgentApp(
  appPath: string,
  env: NodeJS.ProcessEnv,
): Promise<FlueNodeApplication> {
  const mod = await importAgentAppModule(appPath)
  if (typeof mod.loadFlueNodeApplication !== 'function') {
    throw new Error(`${appPath} has no loadFlueNodeApplication export`)
  }
  return mod.loadFlueNodeApplication({ env, local: true })
}

export async function loadEmbeddedAgentApp(
  env: NodeJS.ProcessEnv = process.env,
  options: LoadEmbeddedAgentOptions = {},
): Promise<FlueNodeApplication | null> {
  lastEmbeddedAgentError = null
  const roots = [...defaultAgentSearchRoots(), ...knownInstallBinDirs(env, options.userData)]
  const extraApps = packagedAgentAppPaths(roots, env, options.userData)
  const extraAsars = packagedAsarPaths(roots, env, options.userData)
  let appPath = resolveAgentAppPath(existsSync, roots, extraApps)
  if (!appPath) {
    const asarPath = resolveAppAsarPath(existsSync, roots, extraAsars)
    const destDir = options.extractDir
    if (asarPath && destDir) {
      try {
        const extracted = extractEmbeddedAgentFromAsar(asarPath, destDir)
        if (existsSync(extracted)) {
          console.log(`[agent] extracted Flue from ${asarPath} -> ${destDir}`)
          appPath = extracted
        }
      } catch (err) {
        rememberAgentError('failed to extract agent-server from app.asar', err)
      }
    }
  }
  if (!appPath) {
    rememberAgentError(
      'embedded Flue app.mjs not found; /agents will proxy to 127.0.0.1:8789 when available',
    )
    return null
  }

  try {
    const app = await bootAgentApp(appPath, env)
    console.log(`[agent] embedded Flue loaded from ${appPath}`)
    return app
  } catch (err) {
    const destDir = options.extractDir
    if (destDir && dirname(appPath) !== destDir) {
      try {
        const copied = copyAgentServerTo(appPath, destDir)
        const app = await bootAgentApp(copied, env)
        console.log(`[agent] embedded Flue loaded from ${copied} (copied after ${formatUnknownError(err)})`)
        lastEmbeddedAgentError = null
        return app
      } catch (copyErr) {
        rememberAgentError(`failed to load embedded Flue from ${appPath} and ${destDir}`, copyErr)
        return null
      }
    }
    rememberAgentError(`failed to load embedded Flue from ${appPath}`, err)
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
  details?: string
}

/** Dev fallback when the embed chunk is missing: forward to the Flue vite sidecar. */
export async function proxyAgentsToSidecar(
  req: Request,
  options: ProxyAgentsOptions = {},
): Promise<Response> {
  const packaged = options.packaged ?? Boolean(resolveAppAsarPath())
  if (packaged) {
    return agentUnavailableResponse(
      options.details ??
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
