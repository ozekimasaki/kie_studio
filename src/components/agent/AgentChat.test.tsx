import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useChat } from '@ai-sdk/react'
import { AgentChat } from './AgentChat.tsx'
import { fetchAgentMessages } from '../../lib/agentApi.ts'
import type { AgentRunMode } from '../../lib/agentRunMode.ts'

const chatMocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  stop: vi.fn(),
  setMessages: vi.fn(),
  addToolApprovalResponse: vi.fn(),
}))

const transportMocks = vi.hoisted(() => ({
  lastInit: null as { body?: unknown } | null,
}))

vi.mock('../../lib/agentApi.ts', () => ({
  agentChatUrl: () => '/api/agent/chat',
  fetchAgentMessages: vi.fn().mockResolvedValue([]),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    DefaultChatTransport: class {
      constructor(opts: { body?: unknown } = {}) {
        transportMocks.lastInit = opts
      }
    },
  }
})

vi.mock('@ai-sdk/react', () => ({
  useChat: vi.fn(() => ({
    id: 'conv-1',
    messages: [],
    status: 'ready',
    sendMessage: chatMocks.sendMessage,
    stop: chatMocks.stop,
    error: undefined,
    setMessages: chatMocks.setMessages,
    addToolApprovalResponse: chatMocks.addToolApprovalResponse,
  })),
}))

function chatReturn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    messages: [],
    status: 'ready',
    sendMessage: chatMocks.sendMessage,
    stop: chatMocks.stop,
    error: undefined,
    setMessages: chatMocks.setMessages,
    addToolApprovalResponse: chatMocks.addToolApprovalResponse,
    ...overrides,
  } as never
}

function renderChat({
  isDraft = true,
  onFirstSent,
  agentRunMode = 'agent',
  onAgentRunModeChange = vi.fn(),
}: {
  isDraft?: boolean
  onFirstSent?: (text: string) => void
  agentRunMode?: AgentRunMode
  onAgentRunModeChange?: (mode: AgentRunMode) => void
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AgentChat
        conversationId="conv-1"
        provider="xai"
        model="grok-4"
        isDraft={isDraft}
        agentRunMode={agentRunMode}
        onAgentRunModeChange={onAgentRunModeChange}
        onFirstSent={onFirstSent}
      />
    </QueryClientProvider>,
  )
}

function typeAndSubmit(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'エージェントへのメッセージ' }), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: '送信' }))
}

const approvalMessage = {
  id: 'a1',
  role: 'assistant' as const,
  parts: [
    {
      type: 'tool-generate-media',
      toolName: 'generate-media',
      state: 'approval-requested',
      input: { workflowId: 'flux-dev', title: '夕焼け', input: { prompt: 'sunset sea' } },
      approval: { id: 'apr-1' },
    },
  ],
}

describe('AgentChat', () => {
  beforeEach(() => {
    chatMocks.sendMessage.mockReset()
    chatMocks.stop.mockReset()
    chatMocks.setMessages.mockReset()
    chatMocks.addToolApprovalResponse.mockReset()
    transportMocks.lastInit = null
    vi.mocked(useChat).mockReset()
    vi.mocked(useChat).mockImplementation(() => chatReturn())
    vi.mocked(fetchAgentMessages).mockReset()
    vi.mocked(fetchAgentMessages).mockResolvedValue([])
  })

  afterEach(cleanup)

  it('draft 中は会話履歴を取得しない', async () => {
    renderChat()
    await screen.findByRole('textbox', { name: 'エージェントへのメッセージ' })
    expect(fetchAgentMessages).not.toHaveBeenCalled()
  })

  it('既存会話ではマウント時にメッセージを読み込む', async () => {
    renderChat({ isDraft: false })
    await waitFor(() => expect(fetchAgentMessages).toHaveBeenCalledWith('conv-1'))
  })

  it('既存会話の読み込み失敗を表示する', async () => {
    vi.mocked(fetchAgentMessages).mockRejectedValue(new Error('Request failed (500)'))
    renderChat({ isDraft: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('会話を読み込めませんでした')
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('初回送信は sendMessage し、成功後に永続化コールバックを呼ぶ', async () => {
    chatMocks.sendMessage.mockResolvedValue(undefined)
    const onFirstSent = vi.fn()
    renderChat({ onFirstSent })
    typeAndSubmit('夕焼けの海の画像を作って')
    await waitFor(() =>
      expect(chatMocks.sendMessage).toHaveBeenCalledWith({ text: '夕焼けの海の画像を作って' }),
    )
    await waitFor(() => expect(onFirstSent).toHaveBeenCalledWith('夕焼けの海の画像を作って'))
  })

  it('初回送信が失敗したら入力を復元し、永続化コールバックを呼ばない', async () => {
    chatMocks.sendMessage.mockRejectedValue(new Error('API キーがありません'))
    const onFirstSent = vi.fn()
    renderChat({ onFirstSent })
    typeAndSubmit('失敗するメッセージ')
    await screen.findByText('送信に失敗しました: API キーがありません')
    expect(onFirstSent).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'エージェントへのメッセージ' })).toHaveValue(
      '失敗するメッセージ',
    )
  })

  it('2 通目以降も sendMessage を使う', async () => {
    chatMocks.sendMessage.mockResolvedValue(undefined)
    renderChat({ isDraft: false })
    await screen.findByRole('textbox', { name: 'エージェントへのメッセージ' })
    typeAndSubmit('続きのメッセージ')
    await waitFor(() => expect(chatMocks.sendMessage).toHaveBeenCalledWith({ text: '続きのメッセージ' }))
  })

  it('error 状態では警告を表示し、送信欄をブロックしない', async () => {
    vi.mocked(useChat).mockImplementation(() => chatReturn({ status: 'error', error: new Error('接続できません') }))
    renderChat({ isDraft: false })
    expect(await screen.findByText('接続できません')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('認可待ちの generate-media にボタンを出し、認可で addToolApprovalResponse する', async () => {
    const onMode = vi.fn()
    vi.mocked(useChat).mockImplementation(() => chatReturn({ messages: [approvalMessage] }))
    renderChat({ onAgentRunModeChange: onMode })
    expect(await screen.findByRole('button', { name: '生成を認可' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '却下' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '送信' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '生成を認可' }))
    expect(onMode).toHaveBeenCalledWith('agent')
    expect(chatMocks.addToolApprovalResponse).toHaveBeenCalledWith({
      id: 'apr-1',
      approved: true,
    })
  })

  it('却下は approved: false で返す', async () => {
    vi.mocked(useChat).mockImplementation(() => chatReturn({ messages: [approvalMessage] }))
    renderChat()
    fireEvent.click(await screen.findByRole('button', { name: '却下' }))
    expect(chatMocks.addToolApprovalResponse).toHaveBeenCalledWith({
      id: 'apr-1',
      approved: false,
      reason: 'ユーザーが生成を却下しました',
    })
  })

  it('プランタブをクリックすると onAgentRunModeChange を呼ぶ', async () => {
    const onMode = vi.fn()
    renderChat({ onAgentRunModeChange: onMode })
    fireEvent.click(await screen.findByRole('tab', { name: 'プラン' }))
    expect(onMode).toHaveBeenCalledWith('plan')
  })

  it('プラン選択時は transport body の agentRunMode が plan になる', async () => {
    renderChat({ agentRunMode: 'plan' })
    expect(await screen.findByRole('tab', { name: 'プラン' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/プランモード: 生成は実行しません/)).toBeInTheDocument()
    const body = transportMocks.lastInit?.body
    expect(typeof body).toBe('function')
    expect((body as () => { agentRunMode: string })()).toEqual(
      expect.objectContaining({ agentRunMode: 'plan', conversationId: 'conv-1' }),
    )
  })
})
