import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useFlueAgent } from '@flue/react'
import { AgentChat } from './AgentChat.tsx'

const flueMocks = vi.hoisted(() => ({
  send: vi.fn(),
  abort: vi.fn(),
  sendMessage: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@flue/sdk', () => ({
  createFlueClient: vi.fn(() => ({ send: flueMocks.send, abort: flueMocks.abort })),
}))

vi.mock('@flue/react', () => ({
  useFlueAgent: vi.fn(() => ({
    messages: [],
    status: 'idle',
    historyReady: true,
    error: undefined,
    failedSends: [],
    settlements: [],
    sendMessage: flueMocks.sendMessage,
    refresh: flueMocks.refresh,
  })),
}))

function renderChat({
  isDraft = true,
  onFirstSent,
}: { isDraft?: boolean; onFirstSent?: (text: string) => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AgentChat
        conversationId="conv-1"
        provider="xai"
        model="grok-4"
        isDraft={isDraft}
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

describe('AgentChat', () => {
  afterEach(cleanup)

  it('draft 中は observation を dormant に保つ（client 未注入）', () => {
    renderChat()
    expect(vi.mocked(useFlueAgent).mock.calls[0]?.[0]).toEqual({ client: undefined })
  })

  it('既存会話ではマウント時に client を注入して observe を開始する', () => {
    renderChat({ isDraft: false })
    expect(vi.mocked(useFlueAgent).mock.calls[0]?.[0]?.client).toBeTruthy()
  })

  it('初回送信は initialData を載せ、成功後に observation を有効化する', async () => {
    flueMocks.send.mockResolvedValue({ submissionId: 'sub-1' })
    const onFirstSent = vi.fn()
    renderChat({ onFirstSent })
    typeAndSubmit('夕焼けの海の画像を作って')
    await waitFor(() =>
      expect(flueMocks.send).toHaveBeenCalledWith({
        message: { kind: 'user', body: '夕焼けの海の画像を作って' },
        initialData: { provider: 'xai', model: 'grok-4' },
      }),
    )
    await waitFor(() => expect(onFirstSent).toHaveBeenCalledWith('夕焼けの海の画像を作って'))
    const calls = vi.mocked(useFlueAgent).mock.calls
    expect(calls.at(-1)?.[0]?.client).toBeTruthy()
    expect(flueMocks.sendMessage).not.toHaveBeenCalled()
  })

  it('初回送信が失敗したら入力を復元し、永続化コールバックを呼ばない', async () => {
    flueMocks.send.mockRejectedValue(new Error('Flue API error 502: request failed'))
    const onFirstSent = vi.fn()
    renderChat({ onFirstSent })
    typeAndSubmit('失敗するメッセージ')
    await screen.findByText(
      '送信に失敗しました: エージェントを起動できませんでした。アプリを再起動してください。',
    )
    expect(onFirstSent).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'エージェントへのメッセージ' })).toHaveValue(
      '失敗するメッセージ',
    )
  })

  it('2 通目以降は session の sendMessage を使う', async () => {
    flueMocks.sendMessage.mockResolvedValue(undefined)
    renderChat({ isDraft: false })
    typeAndSubmit('続きのメッセージ')
    await waitFor(() => expect(flueMocks.sendMessage).toHaveBeenCalledWith('続きのメッセージ'))
    expect(flueMocks.send).not.toHaveBeenCalled()
  })

  it('接続不能時は警告を表示し、送信欄をブロックしない', () => {
    vi.mocked(useFlueAgent).mockImplementation(() => ({
      messages: [],
      status: 'connecting',
      historyReady: false,
      error: new Error('Flue API error 502: request failed'),
      failedSends: [],
      settlements: [],
      sendMessage: flueMocks.sendMessage,
      refresh: flueMocks.refresh,
    }))
    renderChat({ isDraft: false })
    expect(screen.getByText(/エージェントを起動できませんでした/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })
})
