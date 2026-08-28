import { describe, expect, it } from 'vitest'
import { STUDIO_AGENT_SYSTEM_PROMPT, STUDIO_PLAN_SYSTEM_PROMPT, systemPromptFor } from './systemPrompt.ts'

describe('systemPromptFor', () => {
  it('モード別にプロンプトを返す', () => {
    expect(systemPromptFor('agent')).toBe(STUDIO_AGENT_SYSTEM_PROMPT)
    expect(systemPromptFor('plan')).toBe(STUDIO_PLAN_SYSTEM_PROMPT)
  })

  it('エージェントは認可ボタン、プランは生成しないことを書く', () => {
    expect(systemPromptFor('agent')).toMatch(/生成を認可/)
    expect(systemPromptFor('plan')).toMatch(/生成は実行しません/)
    expect(systemPromptFor('plan')).toMatch(/generate-media は使えない/)
  })
})
