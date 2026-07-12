import { useId, useState } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import {
  addSnippet,
  loadSnippets,
  removeSnippet,
  type PromptSnippet,
} from '../lib/snippets.ts'
import { Pressable } from './motion/Pressable.tsx'

/**
 * よく使うプロンプト断片の保存・挿入パネル。
 * プロンプト textarea の直下に置く想定。
 */
export function PromptSnippets({
  prompt,
  disabled,
  onInsert,
}: {
  prompt: string
  disabled?: boolean
  onInsert: (text: string) => void
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [snippets, setSnippets] = useState<PromptSnippet[]>(() =>
    loadSnippets(),
  )
  const [title, setTitle] = useState('')

  function handleSave() {
    if (!prompt.trim()) return
    setSnippets(addSnippet(title, prompt))
    setTitle('')
  }

  return (
    <div className="mt-2">
      <Pressable
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
        aria-expanded={open}
        aria-controls={panelId}
        scaleTo={0.97}
      >
        {open ? (
          <ChevronDown size={14} strokeWidth={2} aria-hidden />
        ) : (
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
        )}
        スニペット
        {snippets.length > 0 && ` (${snippets.length})`}
      </Pressable>

      {open && (
        <div
          id={panelId}
          className="mt-2 space-y-2 border-t border-[var(--border)] pt-2"
        >
          <div className="flex gap-1.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="名前（省略可）"
              disabled={disabled}
              className="studio-input min-w-0 flex-1 px-2 py-1.5 text-xs"
            />
            <Pressable
              disabled={disabled || !prompt.trim()}
              onClick={handleSave}
              title="現在のプロンプトをスニペットとして保存"
              className="studio-btn shrink-0"
              scaleTo={0.96}
            >
              現在の内容を保存
            </Pressable>
          </div>

          {snippets.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)]">
              保存済みスニペットはありません
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {snippets.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onInsert(s.text)}
                    title={s.text}
                    className="min-w-0 flex-1 truncate rounded-[var(--radius-md)] bg-[var(--bg)] px-2 py-1.5 text-left text-xs transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
                  >
                    <span className="font-medium">{s.title}</span>
                    <span className="ml-1.5 text-[var(--text-muted)]">
                      {s.text.slice(0, 40)}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`スニペット「${s.title}」を削除`}
                    onClick={() => setSnippets(removeSnippet(s.id))}
                    className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-[var(--text-muted)] transition hover:text-[var(--danger)]"
                  >
                    <X size={14} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
