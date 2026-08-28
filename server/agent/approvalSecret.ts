import { randomBytes } from 'node:crypto'
import { getSetting, setSetting } from '../db/settings.ts'

export const TOOL_APPROVAL_SECRET_KEY = 'agent_tool_approval_secret'

/** Stable HMAC secret for AI SDK tool-approval signatures. Persisted in app_settings. */
export function getToolApprovalSecret(): string {
  const existing = getSetting(TOOL_APPROVAL_SECRET_KEY)
  if (existing && existing.length > 0) return existing
  const secret = randomBytes(32).toString('hex')
  setSetting(TOOL_APPROVAL_SECRET_KEY, secret)
  return secret
}
