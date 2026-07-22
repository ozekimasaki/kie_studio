import { getSetting } from '../db/settings.ts'

/** Settings key under which the KIE API key is persisted. */
export const KIE_API_KEY_SETTING = 'KIE_API_KEY'

const PLACEHOLDER = 'your_api_key_here'

function normalize(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed === PLACEHOLDER) return null
  return trimmed
}

/**
 * Resolve the effective KIE API key.
 * Priority: persisted setting (app_settings) → KIE_API_KEY env var.
 */
export function getStoredApiKey(): string | null {
  return normalize(getSetting(KIE_API_KEY_SETTING)) ?? normalize(process.env.KIE_API_KEY)
}

/** Whether a usable key exists from either the store or the environment. */
export function hasUsableApiKey(): boolean {
  return getStoredApiKey() !== null
}

/** Mask a key for display, e.g. `••••1234`. */
export function maskApiKey(key: string): string {
  const tail = key.slice(-4)
  return `${'\u2022'.repeat(4)}${tail}`
}
