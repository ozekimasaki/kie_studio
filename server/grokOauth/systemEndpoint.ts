/**
 * System-managed custom endpoint for Grok OAuth login.
 */

import { getBuiltinLlmProvider } from '../../src/lib/models/llmProviders.ts'
import {
  GROK_OAUTH_ENDPOINT_ID,
  GROK_OAUTH_ENDPOINT_LABEL,
  GROK_OAUTH_PLACEHOLDER_KEY,
} from './constants.ts'
import { jwtExpiry } from './oauth.ts'
import { isLoggedIn, loadAuthStore } from './store.ts'

export interface GrokOauthSystemEndpoint {
  id: typeof GROK_OAUTH_ENDPOINT_ID
  label: string
  kind: 'openai-compatible'
  baseUrl: string
  models: string[]
  apiKey: string
  system: true
}

export function studioApiBase(): string {
  return process.env.STUDIO_API_BASE?.trim() || 'http://127.0.0.1:8787'
}

export function getGrokOauthStatus(): {
  loggedIn: boolean
  expiresAt: number | null
  lastRefresh: string | null
} {
  const store = loadAuthStore()
  if (!store) {
    return { loggedIn: false, expiresAt: null, lastRefresh: null }
  }
  return {
    loggedIn: true,
    expiresAt: jwtExpiry(store.tokens.access_token),
    lastRefresh: store.last_refresh ?? null,
  }
}

export function getGrokOauthSystemEndpoint(): GrokOauthSystemEndpoint | null {
  if (!isLoggedIn()) return null
  const xai = getBuiltinLlmProvider('xai')
  return {
    id: GROK_OAUTH_ENDPOINT_ID,
    label: GROK_OAUTH_ENDPOINT_LABEL,
    kind: 'openai-compatible',
    baseUrl: `${studioApiBase()}/api/grok-oauth/v1`,
    models: [...(xai?.suggestedModels ?? ['grok-4.5', 'grok-4.3'])],
    apiKey: GROK_OAUTH_PLACEHOLDER_KEY,
    system: true,
  }
}

/** Merge system OAuth endpoint ahead of user custom endpoints (system wins on id clash). */
export function mergeCustomEndpointsWithGrokOauth<
  T extends { id: string },
>(userEndpoints: T[]): Array<T | GrokOauthSystemEndpoint> {
  const system = getGrokOauthSystemEndpoint()
  if (!system) {
    return userEndpoints.filter((e) => e.id !== GROK_OAUTH_ENDPOINT_ID)
  }
  const rest = userEndpoints.filter((e) => e.id !== GROK_OAUTH_ENDPOINT_ID)
  return [system, ...rest]
}
