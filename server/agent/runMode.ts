export const AGENT_RUN_MODES = ['plan', 'agent'] as const

export type AgentRunMode = (typeof AGENT_RUN_MODES)[number]

export const PLAN_ACTIVE_TOOLS = [
  'list-workflows',
  'get-workflow-schema',
  'get-task-status',
  'search-history',
  'get-task-input',
  'get-credit-balance',
  'optimize-prompt',
] as const

export type StudioToolName = (typeof PLAN_ACTIVE_TOOLS)[number] | 'generate-media'

export function parseAgentRunMode(value: unknown): AgentRunMode {
  return value === 'plan' ? 'plan' : 'agent'
}

export function activeToolsFor(mode: AgentRunMode): readonly StudioToolName[] {
  switch (mode) {
    case 'plan':
      return PLAN_ACTIVE_TOOLS
    case 'agent':
      return [...PLAN_ACTIVE_TOOLS, 'generate-media']
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}

export function toolApprovalFor(mode: AgentRunMode): {
  'generate-media': 'user-approval' | 'denied'
} {
  switch (mode) {
    case 'plan':
      return { 'generate-media': 'denied' }
    case 'agent':
      return { 'generate-media': 'user-approval' }
    default: {
      const _exhaustive: never = mode
      return _exhaustive
    }
  }
}
