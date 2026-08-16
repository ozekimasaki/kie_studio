/** Shown when the local API process is unreachable. */
export const AGENT_UNAVAILABLE_MESSAGE =
  'エージェントに接続できませんでした。Studio を再起動してください。'

export const AGENT_UNAVAILABLE_DEV_HINT =
  '開発時は npm run dev（API + Web）で起動してください。'

export function formatAgentSendError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  return AGENT_UNAVAILABLE_MESSAGE
}
