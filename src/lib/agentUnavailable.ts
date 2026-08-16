/** Flue SDK reads `error.type` / `error.message` from the JSON envelope. */
export const AGENT_UNAVAILABLE_TYPE = 'agent_unavailable'

export const AGENT_UNAVAILABLE_MESSAGE =
  'エージェントサーバーに接続できません。アプリを再起動するか、開発時は agent sidecar 込みの npm run dev で起動してください。'

export function agentUnavailableBody(details: string): {
  error: { type: string; message: string; details: string }
} {
  return {
    error: {
      type: AGENT_UNAVAILABLE_TYPE,
      message: AGENT_UNAVAILABLE_MESSAGE,
      details,
    },
  }
}

/**
 * Flue's send() admits the message with HTTP 202 before the LLM runs.
 * `Flue API error 502: request failed` therefore means `/agents` never reached
 * Flue (sidecar down / embed missing / Vite proxy ECONNREFUSED) — not Grok/X.
 */
export function formatAgentSendError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  const match = raw.match(/^Flue API error (\d+)(?: \[([^\]]+)\])?: (.*)$/s)
  if (!match) return raw
  const status = match[1]
  const type = match[2]
  const message = match[3] ?? ''
  if (
    status === '502' &&
    (type === AGENT_UNAVAILABLE_TYPE || message === 'request failed')
  ) {
    return AGENT_UNAVAILABLE_MESSAGE
  }
  if (message && message !== 'request failed') return message
  return raw
}
