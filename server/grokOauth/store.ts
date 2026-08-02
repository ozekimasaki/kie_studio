/**
 * Adapted from grok-oauth-proxy (MIT)
 * https://github.com/ozekimasaki/grok-oauth-proxy
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface StoredTokens {
  access_token: string
  refresh_token: string
  id_token?: string
  token_type?: string
  expires_in?: number
}

export interface AuthStore {
  tokens: StoredTokens
  token_endpoint?: string
  last_refresh?: string
}

export function configDir(): string {
  const override = process.env.GROK_OAUTH_PROXY_HOME?.trim()
  return override || join(homedir(), '.grok-oauth-proxy')
}

export function authPath(): string {
  return join(configDir(), 'auth.json')
}

export function loadAuthStore(): AuthStore | null {
  const path = authPath()
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (typeof raw !== 'object' || raw === null) return null
    const store = raw as AuthStore
    if (!store.tokens || typeof store.tokens.access_token !== 'string') return null
    return store
  } catch {
    return null
  }
}

export function saveAuthStore(store: AuthStore): void {
  mkdirSync(configDir(), { recursive: true })
  const path = authPath()
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  try {
    chmodSync(path, 0o600)
  } catch {
    // Best effort; chmod is a no-op on some platforms.
  }
}

export function clearAuthStore(): boolean {
  const path = authPath()
  if (!existsSync(path)) return false
  rmSync(path)
  return true
}

export function isLoggedIn(): boolean {
  const store = loadAuthStore()
  return Boolean(store?.tokens.refresh_token || store?.tokens.access_token)
}
