import { useState } from 'react'
import {
  addSnippet,
  loadSnippets,
  removeSnippet,
  type PromptSnippet,
} from '../lib/snippets.ts'

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-[var(--text-muted)] transition hover:text-[var(--accent)]"
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} スニペット
        {snippets.length > 0 && ` (${snippets.length})`}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="名前（省略可）"
              disabled={disabled}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              disabled={disabled || !prompt.trim()}
              onClick={handleSave}
              title="現在のプロンプトをスニペットとして保存"
              className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs transition hover:border-[var(--accent)] disabled:opacity-50"
            >
              現在の内容を保存
            </button>
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
                    className="min-w-0 flex-1 truncate rounded-lg border border-transparent bg-[var(--bg)] px-2 py-1.5 text-left text-xs transition hover:border-[var(--accent)] disabled:opacity-50"
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
                    className="shrink-0 rounded-md px-1.5 py-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--danger)]"
                  >
                    ×
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
