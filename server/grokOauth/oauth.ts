/**
 * Adapted from grok-oauth-proxy (MIT)
 * https://github.com/ozekimasaki/grok-oauth-proxy
 */

import {
  XAI_OAUTH_CLIENT_ID,
  XAI_OAUTH_DEVICE_CODE_URL,
  XAI_OAUTH_DISCOVERY_URL,
  XAI_OAUTH_SCOPE,
} from './constants.ts'
import type { StoredTokens } from './store.ts'

export class OAuthError extends Error {
  readonly code: string
  readonly reloginRequired: boolean

  constructor(message: string, code: string, reloginRequired = false) {
    super(message)
    this.name = 'OAuthError'
    this.code = code
    this.reloginRequired = reloginRequired
  }
}

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_uri: string
  verification_uri_complete?: string
  expires_in: number
  interval: number
}

const FORM_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  Accept: 'application/json',
}

/** Only allow OAuth endpoints on the auth.x.ai / x.ai origin so tokens never leak elsewhere. */
export function validateXaiEndpoint(url: string, field: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new OAuthError(`Invalid ${field}: ${url}`, 'invalid_endpoint')
  }
  const host = parsed.hostname.toLowerCase()
  if (parsed.protocol !== 'https:' || (host !== 'x.ai' && !host.endsWith('.x.ai'))) {
    throw new OAuthError(
      `Refusing ${field} ${url} — not on the x.ai origin.`,
      'invalid_endpoint',
    )
  }
  return url
}

export async function discoverTokenEndpoint(): Promise<string> {
  const response = await fetch(XAI_OAUTH_DISCOVERY_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new OAuthError(
      `xAI OIDC discovery failed with HTTP ${response.status}.`,
      'discovery_failed',
    )
  }
  const payload = (await response.json()) as { token_endpoint?: string }
  const tokenEndpoint = payload.token_endpoint?.trim()
  if (!tokenEndpoint) {
    throw new OAuthError(
      'xAI OIDC discovery response was missing token_endpoint.',
      'discovery_incomplete',
    )
  }
  return validateXaiEndpoint(tokenEndpoint, 'token_endpoint')
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const response = await fetch(XAI_OAUTH_DEVICE_CODE_URL, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      client_id: XAI_OAUTH_CLIENT_ID,
      scope: XAI_OAUTH_SCOPE,
    }),
  })
  if (!response.ok) {
    const detail = (await response.text()).trim()
    throw new OAuthError(
      `xAI device-code request failed (HTTP ${response.status}).${detail ? ` Response: ${detail}` : ''}`,
      'device_code_request_failed',
    )
  }
  const payload = (await response.json()) as Partial<DeviceCodeResponse>
  const required: Array<keyof DeviceCodeResponse> = [
    'device_code',
    'user_code',
    'verification_uri',
    'expires_in',
    'interval',
  ]
  const missing = required.filter((key) => payload[key] === undefined)
  if (missing.length > 0) {
    throw new OAuthError(
      `xAI device-code response missing fields: ${missing.join(', ')}`,
      'device_code_invalid',
    )
  }
  return payload as DeviceCodeResponse
}

/**
 * Single poll attempt for device-code token exchange (no sleep loop).
 * Returns tokens on success, or `{ pending: true }` while the user has not approved.
 */
export async function pollDeviceTokenOnce(
  tokenEndpoint: string,
  deviceCode: string,
): Promise<
  | { status: 'success'; tokens: StoredTokens }
  | { status: 'pending'; intervalBump?: number }
> {
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: XAI_OAUTH_CLIENT_ID,
      device_code: deviceCode,
    }),
  })
  if (response.ok) {
    const payload = (await response.json()) as Partial<StoredTokens>
    if (!payload.access_token || !payload.refresh_token) {
      throw new OAuthError(
        'xAI device-code token response was missing access_token or refresh_token.',
        'device_token_invalid',
      )
    }
    return { status: 'success', tokens: payload as StoredTokens }
  }
  let errorCode = ''
  let description = ''
  try {
    const errorPayload = (await response.json()) as {
      error?: string
      error_description?: string
    }
    errorCode = errorPayload.error ?? ''
    description = errorPayload.error_description ?? errorPayload.error ?? ''
  } catch {
    throw new OAuthError(
      `xAI device-code token polling returned HTTP ${response.status} with a non-JSON body.`,
      'device_token_failed',
    )
  }
  if (errorCode === 'authorization_pending') {
    return { status: 'pending' }
  }
  if (errorCode === 'slow_down') {
    return { status: 'pending', intervalBump: 1 }
  }
  throw new OAuthError(
    `xAI device-code token polling failed: ${description || `HTTP ${response.status}`}`,
    'device_token_failed',
  )
}

export async function refreshTokens(
  refreshToken: string,
  tokenEndpoint: string,
): Promise<StoredTokens> {
  if (!refreshToken.trim()) {
    throw new OAuthError(
      'No refresh_token stored. Sign in with your X account again.',
      'missing_refresh_token',
      true,
    )
  }
  validateXaiEndpoint(tokenEndpoint, 'token_endpoint')
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: XAI_OAUTH_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  })
  if (!response.ok) {
    const detail = (await response.text()).trim()
    if (response.status === 403) {
      throw new OAuthError(
        `xAI token refresh failed with HTTP 403.${detail ? ` Response: ${detail}` : ''} ` +
          'This account is not authorized for xAI API access — xAI may restrict ' +
          'OAuth API use to specific SuperGrok tiers. Re-logging in will not change ' +
          'that; consider an XAI_API_KEY instead.',
        'tier_denied',
      )
    }
    throw new OAuthError(
      `xAI token refresh failed (HTTP ${response.status}).${detail ? ` Response: ${detail}` : ''}`,
      'refresh_failed',
      response.status === 400 || response.status === 401,
    )
  }
  const payload = (await response.json()) as Partial<StoredTokens>
  if (!payload.access_token) {
    throw new OAuthError(
      'xAI token refresh response was missing access_token.',
      'refresh_missing_access_token',
      true,
    )
  }
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token?.trim() || refreshToken,
    id_token: payload.id_token,
    token_type: payload.token_type ?? 'Bearer',
    expires_in: payload.expires_in,
  }
}

/** Decode a JWT `exp` claim; returns null when the token is opaque or malformed. */
export function jwtExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

export function isExpiring(token: string, skewSeconds: number): boolean {
  const exp = jwtExpiry(token)
  if (exp === null) return false
  return exp - Date.now() / 1000 <= skewSeconds
}
