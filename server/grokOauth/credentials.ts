/**
 * Adapted from grok-oauth-proxy (MIT)
 * https://github.com/ozekimasaki/grok-oauth-proxy
 */

import { DEFAULT_REFRESH_SKEW_SECONDS } from './constants.ts'
import {
  discoverTokenEndpoint,
  isExpiring,
  OAuthError,
  refreshTokens,
} from './oauth.ts'
import { loadAuthStore, saveAuthStore, type AuthStore } from './store.ts'

/**
 * Return a valid access token, refreshing it first when it expires within the
 * skew window. Persists rotated refresh tokens back to the auth store.
 */
export async function resolveAccessToken(options?: {
  forceRefresh?: boolean
  skewSeconds?: number
}): Promise<string> {
  const store = loadAuthStore()
  if (!store) {
    throw new OAuthError(
      'Not logged in. Sign in with your X account in Settings.',
      'not_logged_in',
      true,
    )
  }
  const skew = options?.skewSeconds ?? DEFAULT_REFRESH_SKEW_SECONDS
  const needsRefresh =
    options?.forceRefresh === true || isExpiring(store.tokens.access_token, skew)
  if (!needsRefresh) return store.tokens.access_token

  const tokenEndpoint =
    store.token_endpoint?.trim() || (await discoverTokenEndpoint())
  const refreshed = await refreshTokens(store.tokens.refresh_token, tokenEndpoint)
  const updated: AuthStore = {
    tokens: refreshed,
    token_endpoint: tokenEndpoint,
    last_refresh: new Date().toISOString(),
  }
  saveAuthStore(updated)
  return refreshed.access_token
}
