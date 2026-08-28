import { useState } from 'react'
import { Check, ChevronRight, Loader2, ShieldCheck, Wrench, X } from 'lucide-react'

export type ToolLikePart = {
  type: string
  toolName?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
  approval?: { id?: string; approved?: boolean; reason?: string }
}

export function isToolPart(part: { type: string }): part is ToolLikePart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

export function toolNameOf(part: ToolLikePart): string {
  if (typeof part.toolName === 'string' && part.toolName) return part.toolName
  if (part.type.startsWith('tool-')) return part.type.slice('tool-'.length)
  return part.type
}

function fieldOf(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== 'object' || !(key in input)) return undefined
  const value = (input as Record<string, unknown>)[key]
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function toolSummary(part: ToolLikePart): string {
  const name = toolNameOf(part)
  const input = part.input
  switch (name) {
    case 'list-workflows':
      return `ワークフロー検索 ${fieldOf(input, 'capability') ?? fieldOf(input, 'q') ?? fieldOf(input, 'category') ?? ''}`.trim()
    case 'get-workflow-schema':
      return `スキーマ確認 ${fieldOf(input, 'id') ?? ''}`.trim()
    case 'generate-media':
      return `生成 ${fieldOf(input, 'title') ?? fieldOf(input, 'workflowId') ?? ''}`.trim()
    case 'get-task-status':
      return `状態確認 ${(fieldOf(input, 'taskId') ?? '').slice(0, 12)}…`
    case 'search-history':
      return `履歴検索 ${fieldOf(input, 'q') ?? ''}`.trim()
    case 'get-task-input':
      return '入力の復元'
    case 'get-credit-balance':
      return '残高確認'
    case 'optimize-prompt':
      return 'プロンプト最適化'
    default:
      return name
  }
}

function generateParamLines(input: unknown): string[] {
  if (!input || typeof input !== 'object') return []
  const rec = input as Record<string, unknown>
  const lines: string[] = []
  if (typeof rec.workflowId === 'string' && rec.workflowId) {
    lines.push(`workflow: ${rec.workflowId}`)
  }
  const params = rec.input
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params).slice(0, 6)) {
      const text = typeof value === 'string' ? value : JSON.stringify(value)
      lines.push(`${key}: ${text.length > 80 ? `${text.slice(0, 80)}…` : text}`)
    }
  }
  return lines
}

export function approvalIdOf(part: ToolLikePart): string | null {
  const id = part.approval?.id
  return typeof id === 'string' && id ? id : null
}

export function AgentToolCard({
  part,
  onApprove,
  onDeny,
}: {
  part: ToolLikePart
  onApprove?: (approvalId: string) => void
  onDeny?: (approvalId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const running = part.state === 'input-available' || part.state === 'input-streaming'
  const awaitingApproval = part.state === 'approval-requested'
  const responded = part.state === 'approval-responded'
  const denied = part.state === 'output-denied'
  const errored = part.state === 'output-error'
  const approvalId = approvalIdOf(part)
  const canDecide =
    awaitingApproval &&
    approvalId &&
    toolNameOf(part) === 'generate-media' &&
    onApprove &&
    onDeny
  const paramLines = canDecide ? generateParamLines(part.input) : []

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[var(--text-muted)]"
      >
        {running || responded ? (
          <Loader2 size={13} className="animate-spin text-[var(--accent)]" aria-hidden />
        ) : awaitingApproval ? (
          <ShieldCheck size={13} className="text-[var(--accent)]" aria-hidden />
        ) : (
          <Wrench size={13} aria-hidden />
        )}
        <span className="flex-1 truncate font-mono">{toolSummary(part)}</span>
        {awaitingApproval && <span className="text-[var(--accent)]">認可待ち</span>}
        {responded && <span className="text-[var(--text-muted)]">実行中</span>}
        {denied && <span className="text-[var(--danger)]">却下</span>}
        {errored && <span className="text-[var(--danger)]">error</span>}
        {part.state === 'output-available' && (
          <ChevronRight
            size={13}
            aria-hidden
            className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
          />
        )}
      </button>
      {canDecide && approvalId && (
        <div className="grid gap-2 border-t border-[var(--border)] px-3 py-2">
          {paramLines.length > 0 && (
            <ul className="grid gap-0.5 text-[var(--text-muted)]">
              {paramLines.map((line) => (
                <li key={line} className="truncate">
                  {line}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[var(--text)]">この内容で生成してよいですか？クレジットを消費します。</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="studio-btn-primary studio-btn-compact"
              onClick={() => onApprove(approvalId)}
            >
              <Check size={14} aria-hidden />
              生成を認可
            </button>
            <button type="button" className="studio-btn w-auto px-3 py-1.5" onClick={() => onDeny(approvalId)}>
              <X size={14} aria-hidden />
              却下
            </button>
          </div>
        </div>
      )}
      {open && part.state === 'output-available' && (
        <pre className="max-h-56 overflow-auto border-t border-[var(--border)] px-3 py-2 whitespace-pre-wrap break-words text-[var(--text-muted)]">
          {JSON.stringify(part.output, null, 2)}
        </pre>
      )}
      {denied && part.approval?.reason && (
        <p className="border-t border-[var(--border)] px-3 py-2 text-[var(--text-muted)]">
          {part.approval.reason}
        </p>
      )}
      {errored && (
        <p className="border-t border-[var(--border)] px-3 py-2 text-[var(--danger)]">{part.errorText}</p>
      )}
    </div>
  )
}
