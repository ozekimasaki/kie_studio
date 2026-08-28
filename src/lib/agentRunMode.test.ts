import { describe, expect, it } from 'vitest'
import { parseAgentRunMode } from './agentRunMode.ts'

describe('parseAgentRunMode', () => {
  it('plan 以外は agent', () => {
    expect(parseAgentRunMode('plan')).toBe('plan')
    expect(parseAgentRunMode('agent')).toBe('agent')
    expect(parseAgentRunMode(undefined)).toBe('agent')
  })
})
