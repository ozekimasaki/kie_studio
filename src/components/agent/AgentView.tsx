import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, MessageSquarePlus, PanelLeft, Settings, Trash2 } from 'lucide-react'
import {
  createAgentConversation,
  deleteAgentConversation,
  fetchAgentConversations,
  newConversationId,
  renameAgentConversation,
  type AgentConversation,
} from '../../lib/agentApi.ts'
import { AgentChat } from './AgentChat.tsx'
import { AgentModelPicker, type ModelSelection } from './AgentModelPicker.tsx'

function NewConversationPanel({
  onCreated,
  onCancel,
  onOpenSettings,
}: {
  onCreated: (conversation: AgentConversation) => void
  onCancel: () => void
  onOpenSettings?: () => void
}) {
  const queryClient = useQueryClient()
  const [selection, setSelection] = useState<ModelSelection | null>(null)

  const createMutation = useMutation({
    mutationFn: createAgentConversation,
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: ['agent-conversations'] })
      onCreated(conversation)
    },
  })

  const canStart = Boolean(selection?.provider && selection.model.trim())

  return (
    <div className="mx-auto grid max-w-lg gap-4 px-4 py-8">
      <div>
        <h2 className="studio-empty-title">新しいエージェント会話</h2>
        <p className="studio-empty-body mt-1">
          会話ごとに LLM を選びます。API キーとモデルは設定画面で登録できます。
        </p>
      </div>
      <AgentModelPicker
        value={selection}
        onChange={setSelection}
        onOpenSettings={onOpenSettings}
      />
      {createMutation.isError && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {(createMutation.error as Error).message}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="studio-btn-primary flex-1 py-2"
          disabled={!canStart || createMutation.isPending}
          onClick={() => {
            if (!selection?.model.trim()) return
            createMutation.mutate({
              id: newConversationId(),
              title: '新しい会話',
              provider: selection.provider,
              model: selection.model.trim(),
            })
          }}
        >
          会話を開始
        </button>
        <button type="button" className="studio-btn w-auto px-4 py-2" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  )
}

export function AgentView({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const queryClient = useQueryClient()
  const conversationsQuery = useQuery({
    queryKey: ['agent-conversations'],
    queryFn: fetchAgentConversations,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNewFlow, setIsNewFlow] = useState(false)
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data])
  const selected = conversations.find((c) => c.id === selectedId) ?? null

  // Select the most recent conversation on first load.
  useEffect(() => {
    if (selectedId || isNewFlow || conversations.length === 0) return
    setSelectedId(conversations[0]!.id)
  }, [conversations, selectedId, isNewFlow])

  const startNewFlow = useCallback(() => {
    setIsNewFlow(true)
    setSelectedId(null)
    setSidebarOpen(false)
  }, [])

  const handleCreated = useCallback((conversation: AgentConversation) => {
    setIsNewFlow(false)
    setSelectedId(conversation.id)
    setFreshIds((prev) => new Set(prev).add(conversation.id))
  }, [])

  const handleFirstMessage = useCallback(
    (text: string) => {
      if (!selected) return
      const title = text.length > 32 ? `${text.slice(0, 32)}…` : text
      void renameAgentConversation(selected.id, title)
        .then(() => queryClient.invalidateQueries({ queryKey: ['agent-conversations'] }))
        .catch(() => {})
    },
    [selected, queryClient],
  )

  const handleDelete = useCallback(
    (conversation: AgentConversation) => {
      if (!window.confirm(`会話「${conversation.title}」を削除しますか？`)) return
      void deleteAgentConversation(conversation.id).then(() => {
        if (selectedId === conversation.id) setSelectedId(null)
        void queryClient.invalidateQueries({ queryKey: ['agent-conversations'] })
      })
    },
    [selectedId, queryClient],
  )

  const selectConversation = useCallback((id: string) => {
    setIsNewFlow(false)
    setSelectedId(id)
    setSidebarOpen(false)
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col text-[var(--text)]">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-3 py-2 sm:gap-2">
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="studio-btn w-auto shrink-0 px-2 py-1.5"
          aria-label="会話一覧の表示切替"
          aria-expanded={sidebarOpen}
        >
          <PanelLeft size={15} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <Bot size={16} className="shrink-0 text-[var(--accent)]" aria-hidden />
          <h2 className="min-w-0 truncate text-sm font-semibold">
            {selected && !isNewFlow ? selected.title : 'エージェント'}
          </h2>
          {selected && !isNewFlow && (
            <span className="studio-meta hidden max-w-[9rem] shrink truncate text-[10px] sm:inline">
              {selected.provider}/{selected.model}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selected && !isNewFlow && (
            <button
              type="button"
              onClick={() => handleDelete(selected)}
              className="studio-btn w-auto px-2 py-1.5 text-[var(--danger)]"
              aria-label="この会話を削除"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={startNewFlow}
            className="studio-btn-primary studio-btn-compact"
            aria-label="新規会話"
          >
            <MessageSquarePlus size={14} aria-hidden />
            新規
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            type="button"
            className="absolute inset-0 z-[1] bg-[oklch(0.2_0.02_250_/_0.35)] sm:hidden"
            aria-label="会話一覧を閉じる"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {sidebarOpen && (
          <aside
            className="absolute inset-y-0 left-0 z-[2] flex w-64 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] shadow-lg sm:static sm:z-auto sm:w-56 sm:shadow-none"
            aria-label="会話一覧"
          >
            {conversationsQuery.isLoading ? (
              <p className="p-3 text-xs text-[var(--text-muted)]">読込中…</p>
            ) : conversations.length === 0 ? (
              <p className="p-3 text-xs text-[var(--text-muted)]">
                会話はまだありません。「新規」から始められます。
              </p>
            ) : (
              <ul className="grid gap-0.5 p-2">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`w-full rounded-[var(--radius-md)] px-2.5 py-2 text-left text-xs ${
                        conversation.id === selectedId && !isNewFlow
                          ? 'bg-[var(--surface-raised)] font-medium text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--surface-raised)]'
                      }`}
                    >
                      <span className="block truncate">{conversation.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] opacity-70">
                        {conversation.provider}/{conversation.model}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <main
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${
            isNewFlow ? 'overflow-y-auto' : 'overflow-hidden'
          }`}
        >
          {isNewFlow ? (
            <NewConversationPanel
              onCreated={handleCreated}
              onCancel={() => setIsNewFlow(false)}
              onOpenSettings={onOpenSettings}
            />
          ) : selected ? (
            <AgentChat
              key={selected.id}
              conversationId={selected.id}
              provider={selected.provider}
              model={selected.model}
              isNew={freshIds.has(selected.id)}
              onFirstMessage={handleFirstMessage}
            />
          ) : (
            <div className="grid flex-1 place-items-center px-4">
              <div className="text-center">
                <Bot size={32} className="mx-auto text-[var(--accent)]" aria-hidden />
                <p className="studio-empty-title mt-3">エージェントモード</p>
                <p className="studio-empty-body mt-2">
                  LLM と会話しながら画像・動画・音声を生成します。
                  <br />
                  「新規」から会話を始めてください。
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={startNewFlow}
                    className="studio-btn-primary studio-btn-compact px-4"
                  >
                    新規会話
                  </button>
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="studio-btn w-auto gap-1.5 px-3 py-2 text-sm"
                    >
                      <Settings size={14} aria-hidden />
                      LLM 設定
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
