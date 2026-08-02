/**
 * Adapted from grok-oauth-proxy (MIT)
 * https://github.com/ozekimasaki/grok-oauth-proxy
 */

export const XAI_OAUTH_ISSUER = 'https://auth.x.ai'
export const XAI_OAUTH_DISCOVERY_URL = `${XAI_OAUTH_ISSUER}/.well-known/openid-configuration`
export const XAI_OAUTH_DEVICE_CODE_URL = `${XAI_OAUTH_ISSUER}/oauth2/device/code`

/** Public OAuth client id used by Grok CLI-style device-code logins. */
export const XAI_OAUTH_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828'
export const XAI_OAUTH_SCOPE =
  'openid profile email offline_access grok-cli:access api:access'

export const DEFAULT_XAI_BASE_URL = 'https://api.x.ai/v1'

/** Refresh the access token when it expires within this window. */
export const DEFAULT_REFRESH_SKEW_SECONDS = 120

/** Reserved custom-endpoint id injected when OAuth login is active. */
export const GROK_OAUTH_ENDPOINT_ID = 'grok-oauth'
export const GROK_OAUTH_ENDPOINT_LABEL = 'Grok (X アカウント)'
export const GROK_OAUTH_PLACEHOLDER_KEY = 'oauth'
