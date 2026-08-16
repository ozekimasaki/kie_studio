// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentModelError } from './errors.ts'

vi.mock('../settings/llmKeys.ts', () => ({
  getLlmApiKey: vi.fn(),
  getCustomLlmEndpoints: vi.fn(() => []),
}))

vi.mock('../grokOauth/systemEndpoint.ts', () => ({
  mergeCustomEndpointsWithGrokOauth: (endpoints: unknown[]) => endpoints,
}))

const { getLlmApiKey, getCustomLlmEndpoints } = await import('../settings/llmKeys.ts')
const { resolveLanguageModel } = await import('./resolveModel.ts')

describe('resolveLanguageModel', () => {
  beforeEach(() => {
    vi.mocked(getLlmApiKey).mockReset()
    vi.mocked(getCustomLlmEndpoints).mockReset()
    vi.mocked(getCustomLlmEndpoints).mockReturnValue([])
  })

  it('throws when a builtin key is missing', () => {
    vi.mocked(getLlmApiKey).mockReturnValue(null)
    expect(() => resolveLanguageModel('xai', 'grok-4.5')).toThrow(AgentModelError)
    expect(() => resolveLanguageModel('xai', 'grok-4.5')).toThrow(/API キー/)
  })

  it('throws for an unknown provider id', () => {
    expect(() => resolveLanguageModel('not-a-provider', 'm')).toThrow(/未知のプロバイダ/)
  })

  it('returns a language model when a builtin key is present', () => {
    vi.mocked(getLlmApiKey).mockReturnValue('sk-test')
    const model = resolveLanguageModel('openai', 'gpt-5.4')
    expect(model).toBeTruthy()
  })

  it('resolves an OpenAI-compatible custom endpoint', () => {
    vi.mocked(getCustomLlmEndpoints).mockReturnValue([
      {
        id: 'local',
        label: 'Local',
        kind: 'openai-compatible',
        baseUrl: 'http://127.0.0.1:1234/v1',
        models: ['demo'],
        apiKey: 'local-key',
      },
    ])
    const model = resolveLanguageModel('custom-local', 'demo')
    expect(model).toBeTruthy()
  })
})
