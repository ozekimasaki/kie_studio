// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertArrayToReadableStream, convertReadableStreamToArray, MockLanguageModelV3 } from 'ai/test'
import { streamText } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-agent-chat-approval-')),
  'studio.db',
)

vi.mock('./actions.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./actions.ts')>()
  return {
    ...actual,
    generateMedia: vi.fn(),
  }
})

const { generateMedia } = await import('./actions.ts')
const { createStudioStreamOptions } = await import('./chat.ts')

const GENERATE_INPUT = JSON.stringify({
  workflowId: 'demo-image',
  input: { prompt: 'sunset' },
  title: '夕焼け',
})

function mockModelThatCallsGenerate() {
  return new MockLanguageModelV3({
    doStream: {
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        {
          type: 'response-metadata',
          id: 'id-0',
          modelId: 'mock',
          timestamp: new Date(0),
        },
        {
          type: 'tool-call',
          toolCallId: 'call-generate',
          toolName: 'generate-media',
          input: GENERATE_INPUT,
        },
        {
          type: 'finish',
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
          usage: {
            inputTokens: { total: 8, noCache: 8, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 4, text: 4, reasoning: undefined },
          },
        },
      ]),
    },
  })
}

async function collectStream(mode: 'plan' | 'agent') {
  const result = streamText({
    model: mockModelThatCallsGenerate(),
    prompt: '夕焼けの画像を作って',
    ...createStudioStreamOptions({ agentRunMode: mode }),
  })
  return convertReadableStreamToArray(result.fullStream)
}

describe('createStudioStreamOptions + generate-media approval', () => {
  beforeEach(() => {
    vi.mocked(generateMedia).mockReset()
    vi.mocked(generateMedia).mockResolvedValue({
      taskId: 'task-1',
      workflow: 'Demo',
      note: 'started',
      schema: {
        id: 'demo-image',
        title: 'Demo',
        model: 'demo',
        category: 'image',
        provider: 'market',
        operation: 'generate',
        fields: [],
      },
    })
  })

  it('エージェントでは未認可の generate-media を実行しない', async () => {
    const parts = await collectStream('agent')
    expect(generateMedia).not.toHaveBeenCalled()
    expect(parts.some((part) => part.type === 'tool-approval-request')).toBe(true)
    expect(parts.some((part) => part.type === 'tool-result')).toBe(false)
  })

  it('プランでは generate-media を実行せず tool-error にする', async () => {
    const parts = await collectStream('plan')
    expect(generateMedia).not.toHaveBeenCalled()
    expect(parts.some((part) => part.type === 'tool-error')).toBe(true)
    expect(parts.some((part) => part.type === 'tool-result')).toBe(false)
  })

  it('generate-media が active でも denied なら実行しない', async () => {
    const result = streamText({
      model: mockModelThatCallsGenerate(),
      prompt: '夕焼けの画像を作って',
      ...createStudioStreamOptions({ agentRunMode: 'agent' }),
      toolApproval: { 'generate-media': 'denied' },
    })
    const parts = await convertReadableStreamToArray(result.fullStream)
    expect(generateMedia).not.toHaveBeenCalled()
    expect(parts.some((part) => part.type === 'tool-approval-request')).toBe(true)
    expect(parts.some((part) => part.type === 'tool-approval-response')).toBe(true)
    expect(parts.some((part) => part.type === 'tool-result')).toBe(false)
  })
})
