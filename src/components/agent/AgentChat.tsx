import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createFlueClient, type FlueClient } from '@flue/sdk'
import { useFlueAgent, type FlueConversationMessage, type FlueConversationPart } from '@flue/react'
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  Loader2,
  SendHorizontal,
  Square,
  Wrench,
} from 'lucide-react'
import { agentConversationUrl } from '../../lib/agentApi.ts'
import { AgentMediaTaskCard } from './AgentMediaTaskCard.tsx'
import { readMediaTaskData } from './mediaTaskData.ts'

type ToolPart = Extract<FlueConversationPart, { type: 'dynamic-tool' }>

/** One-line `verb arg` summary of a tool call (demo tool-display pattern). */
function toolSummary(part: ToolPart): string {
  const input = part.input
  const field = (key: string): string | undefined => {
    if (input && typeof input === 'object' && key in input) {
      const v = (input as Record<string, unknown>)[key]
      if (typeof v === 'string') return v
      if (typeof v === 'number') return String(v)
    }
    return undefined
  }
  switch (part.toolName) {
    case 'list-workflows':
      return `ワークフロー検索 ${field('capability') ?? field('q') ?? field('category') ?? ''}`.trim()
    case 'get-workflow-schema':
      return `スキーマ確認 ${field('id') ?? ''}`.trim()
    case 'generate-media':
      return `生成 ${field('title') ?? field('workflowId') ?? ''}`.trim()
    case 'get-task-status':
      return `状態確認 ${(field('taskId') ?? '').slice(0, 12)}…`
    case 'search-history':
      return `履歴検索 ${field('q') ?? ''}`.trim()
    case 'get-task-input':
      return '入力の復元'
    case 'get-credit-balance':
      return '残高確認'
    case 'optimize-prompt':
      return 'プロンプト最適化'
    default:
      return part.toolName
  }
}

function ToolCard({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const running = part.state === 'input-available'
  const errored = part.state === 'output-error'
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--text-muted)]"
      >
        {running ? (
          <Loader2 size={13} className="animate-spin text-[var(--accent)]" aria-hidden />
        ) : (
          <Wrench size={13} aria-hidden />
        )}
        <span className="flex-1 truncate font-mono">{toolSummary(part)}</span>
        {errored && <span className="text-[var(--danger)]">error</span>}
        {part.state === 'output-available' && (
          <ChevronRight
            size={13}
            aria-hidden
            className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
          />
        )}
      </button>
      {open && part.state === 'output-available' && (
        <pre className="max-h-56 overflow-auto border-t border-[var(--border)] px-3 py-2 whitespace-pre-wrap break-words text-[var(--text-muted)]">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
      {errored && (
        <p className="border-t border-[var(--border)] px-3 py-2 text-[var(--danger)]">
          {part.errorText}
        </p>
      )}
    </div>
  )
}

function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(streaming)
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--text-muted)]"
      >
        <Brain size={13} aria-hidden />
        <span>{streaming ? '思考中…' : '思考'}</span>
        <ChevronRight
          size={13}
          aria-hidden
          className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
        />
      </button>
      {open && (
        <p className="border-t border-[var(--border)] px-3 py-2 whitespace-pre-wrap text-[var(--text-muted)]">
          {text}
        </p>
      )}
    </div>
  )
}

function MessagePart({ part }: { part: FlueConversationPart }) {
  switch (part.type) {
    case 'text':
      return <p className="whitespace-pre-wrap break-words">{part.text}</p>
    case 'reasoning':
      return <ReasoningBlock text={part.text} streaming={part.state === 'streaming'} />
    case 'file':
      if (part.url && part.mediaType.startsWith('image/')) {
        return (
          <img
            src={part.url}
            alt={part.filename ?? '添付'}
            className="max-h-48 rounded-[var(--radius-md)]"
          />
        )
      }
      return <span className="text-xs text-[var(--text-muted)]">{part.filename ?? part.mediaType}</span>
    case 'dynamic-tool':
      return <ToolCard part={part} />
    default:
      if (part.type === 'data-media-task') {
        const data = readMediaTaskData((part as { data: unknown }).data)
        if (data) return <AgentMediaTaskCard data={data} />
      }
      return null
  }
}

function MessageBubble({ message }: { message: FlueConversationMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-[var(--radius-lg)] rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm text-[var(--on-accent)]'
            : 'grid w-full max-w-full gap-2 px-1 text-sm text-[var(--text)]'
        }
      >
        {message.parts.map((part, i) => (
          <MessagePart key={i} part={part} />
        ))}
      </div>
    </div>
  )
}

export interface AgentChatProps {
  conversationId: string
  provider: string
  model: string
  /** True while the conversation has not sent its first message yet. */
  isNew: boolean
  onFirstMessage?: (text: string) => void
}

export function AgentChat({ conversationId, provider, model, isNew, onFirstMessage }: AgentChatProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const freshRef = useRef(isNew)
  const seenTaskIdsRef = useRef(new Set<string>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const client: FlueClient = useMemo(
    () => createFlueClient({ url: agentConversationUrl(conversationId) }),
    [conversationId],
  )
  const agent = useFlueAgent({ client })

  // Invalidate the studio history when the agent created a task, so the
  // gallery and its polling pick it up without a manual refresh.
  useEffect(() => {
    for (const message of agent.messages) {
      for (const part of message.parts) {
        if (part.type !== 'dynamic-tool' || part.state !== 'output-available') continue
        if (part.toolName !== 'generate-media') continue
        const output = part.output as { taskId?: unknown } | undefined
        const taskId = output && typeof output.taskId === 'string' ? output.taskId : null
        if (taskId && !seenTaskIdsRef.current.has(taskId)) {
          seenTaskIdsRef.current.add(taskId)
          void queryClient.invalidateQueries({ queryKey: ['history'] })
        }
      }
    }
  }, [agent.messages, queryClient])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [agent.messages])

  const busy = agent.status === 'submitted' || agent.status === 'streaming' || agent.status === 'connecting'

  async function submit() {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setSendError(null)
    try {
      if (freshRef.current) {
        freshRef.current = false
        // First send carries the model selection as instance-creation data.
        await client.send({
          message: { kind: 'user', body: text },
          initialData: { provider, model },
        })
        onFirstMessage?.(text)
      } else {
        await agent.sendMessage(text)
      }
    } catch (error) {
      setInput(text)
      setSendError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto grid max-w-3xl gap-4">
          {agent.messages.length === 0 && (
            <div className="py-16 text-center">
              <p className="studio-empty-title">エージェントに話しかけましょう</p>
              <p className="studio-empty-body mt-2">
                例: 「夕焼けの海の画像を作って」「この写真を動画にして」「曲の続きを作って」
              </p>
            </div>
          )}
          {agent.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {busy && (
            <p className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
              <Loader2 size={13} className="animate-spin" aria-hidden />
              {agent.status === 'streaming' ? '応答を生成中…' : '送信中…'}
            </p>
          )}
          {agent.status === 'error' && (
            <p className="flex items-center gap-2 px-1 text-xs text-[var(--danger)]" role="alert">
              <AlertTriangle size={13} aria-hidden />
              エージェントとの通信でエラーが発生しました。もう一度送信してください。
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {sendError && (
            <p className="mb-2 text-xs text-[var(--danger)]" role="alert">
              送信に失敗しました: {sendError}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void submit()
                }
              }}
              rows={Math.min(6, Math.max(2, input.split('\n').length))}
              placeholder="メッセージを入力… (Enter で送信 / Shift+Enter で改行)"
              className="studio-input min-w-0 flex-1 resize-none"
              aria-label="エージェントへのメッセージ"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => void client.abort()}
                className="studio-btn w-auto shrink-0 px-3 py-2"
                aria-label="応答を停止"
              >
                <Square size={16} aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!input.trim()}
                className="studio-btn-primary studio-btn-compact"
                aria-label="送信"
              >
                <SendHorizontal size={16} aria-hidden />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-[var(--text-muted)]">
            {provider}/{model} · 生成には kie.ai クレジットを消費します
          </p>
        </div>
      </div>
    </div>
  )
}

