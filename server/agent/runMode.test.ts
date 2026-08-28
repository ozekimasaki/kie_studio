import { describe, expect, it } from 'vitest'
import {
  activeToolsFor,
  parseAgentRunMode,
  toolApprovalFor,
} from './runMode.ts'

describe('parseAgentRunMode', () => {
  it('plan だけを plan として扱う', () => {
    expect(parseAgentRunMode('plan')).toBe('plan')
  })

  it('それ以外は agent にフォールバックする', () => {
    expect(parseAgentRunMode('agent')).toBe('agent')
    expect(parseAgentRunMode(undefined)).toBe('agent')
    expect(parseAgentRunMode('nope')).toBe('agent')
  })
})

describe('activeToolsFor', () => {
  it('プランでは generate-media を含めない', () => {
    expect(activeToolsFor('plan')).not.toContain('generate-media')
    expect(activeToolsFor('plan')).toContain('list-workflows')
    expect(activeToolsFor('plan')).toContain('get-workflow-schema')
  })

  it('エージェントでは generate-media を含む', () => {
    expect(activeToolsFor('agent')).toContain('generate-media')
  })
})

describe('toolApprovalFor', () => {
  it('プランでは generate-media を denied にする', () => {
    expect(toolApprovalFor('plan')).toEqual({ 'generate-media': 'denied' })
  })

  it('エージェントでは generate-media を user-approval にする', () => {
    expect(toolApprovalFor('agent')).toEqual({ 'generate-media': 'user-approval' })
  })
})
