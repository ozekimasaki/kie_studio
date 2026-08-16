import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Matches `electrobun.config.ts` `app.identifier`. */
export const STUDIO_APP_IDENTIFIER = 'ai.kie.studio'
export const STUDIO_CHANNELS = ['canary', 'stable', 'dev'] as const

function addUnique(out: string[], value: string | undefined): void {
  if (!value) return
  if (!out.includes(value)) out.push(value)
}

export function defaultSearchRoots(): string[] {
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
 * cwd / argv0 / import.meta.url then all point at Temp, so `../Resources/version.json`
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
  if (exists(join(here, 'Resources/version.json')) && exists(join(here, 'bin'))) {
    const bin = join(here, 'bin')
    chdir(bin)
    return bin
  }
  for (const root of [...defaultSearchRoots(), ...knownInstallBinDirs(env)]) {
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
