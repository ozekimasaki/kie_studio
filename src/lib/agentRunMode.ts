export const AGENT_RUN_MODES = ['plan', 'agent'] as const

export type AgentRunMode = (typeof AGENT_RUN_MODES)[number]

export function parseAgentRunMode(value: unknown): AgentRunMode {
  return value === 'plan' ? 'plan' : 'agent'
}
