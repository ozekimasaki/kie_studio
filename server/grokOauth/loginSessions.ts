/**
 * In-memory device-code login sessions. The client polls; the server never
 * long-polls xAI in a single HTTP request.
 */

import { randomUUID } from 'node:crypto'
import {
  discoverTokenEndpoint,
  OAuthError,
  pollDeviceTokenOnce,
  requestDeviceCode,
} from './oauth.ts'
import { saveAuthStore } from './store.ts'

export interface LoginStartResult {
  sessionId: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string | null
  expiresIn: number
  interval: number
}

export type LoginPollResult =
  | { status: 'pending'; interval: number }
  | { status: 'success' }
  | { status: 'error'; message: string; code: string }

interface LoginSession {
  deviceCode: string
  tokenEndpoint: string
  userCode: string
  verificationUri: string
  verificationUriComplete: string | null
  expiresAt: number
  interval: number
}

const sessions = new Map<string, LoginSession>()

function pruneExpired(): void {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id)
  }
}

export async function startLoginSession(): Promise<LoginStartResult> {
  pruneExpired()
  const tokenEndpoint = await discoverTokenEndpoint()
  const device = await requestDeviceCode()
  const sessionId = randomUUID()
  const expiresAt = Date.now() + Math.max(1, device.expires_in) * 1000
  const interval = Math.max(1, device.interval)
  sessions.set(sessionId, {
    deviceCode: device.device_code,
    tokenEndpoint,
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    verificationUriComplete: device.verification_uri_complete ?? null,
    expiresAt,
    interval,
  })
  return {
    sessionId,
    userCode: device.user_code,
    verificationUri: device.verification_uri,
    verificationUriComplete: device.verification_uri_complete ?? null,
    expiresIn: device.expires_in,
    interval,
  }
}

export async function pollLoginSession(sessionId: string): Promise<LoginPollResult> {
  pruneExpired()
  const session = sessions.get(sessionId)
  if (!session) {
    return {
      status: 'error',
      message: 'Login session not found or expired. Start again.',
      code: 'session_not_found',
    }
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return {
      status: 'error',
      message: 'Timed out waiting for X authorization.',
      code: 'device_code_timeout',
    }
  }
  try {
    const result = await pollDeviceTokenOnce(session.tokenEndpoint, session.deviceCode)
    if (result.status === 'pending') {
      if (result.intervalBump) {
        session.interval = Math.min(session.interval + result.intervalBump, 30)
      }
      return { status: 'pending', interval: session.interval }
    }
    saveAuthStore({
      tokens: result.tokens,
      token_endpoint: session.tokenEndpoint,
      last_refresh: new Date().toISOString(),
    })
    sessions.delete(sessionId)
    return { status: 'success' }
  } catch (error) {
    sessions.delete(sessionId)
    if (error instanceof OAuthError) {
      return { status: 'error', message: error.message, code: error.code }
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Login failed',
      code: 'login_failed',
    }
  }
}

export function cancelLoginSession(sessionId: string): boolean {
  return sessions.delete(sessionId)
}

/** Test helper: clear all in-memory sessions. */
export function clearLoginSessionsForTests(): void {
  sessions.clear()
}
