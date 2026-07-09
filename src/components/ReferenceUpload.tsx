import { useRef, useState } from 'react'
import { uploadFile } from '../lib/api.ts'
import { formatMention } from '../lib/models/mentions.ts'
import type { MentionStyle } from '../lib/models/types.ts'

export function ReferenceUpload({
  value,
  onChange,
  maxItems = 8,
  accept = 'image/*',
  disabled,
  mentionStyle = 'at-image',
  onInsertMention,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  maxItems?: number
  accept?: string
  disabled?: boolean
  mentionStyle?: MentionStyle
  onInsertMention?: (token: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      const remaining = Math.max(0, maxItems - value.length)
      const list = [...files].slice(0, remaining)
      const urls: string[] = []
      for (const file of list) {
        urls.push(await uploadFile(file))
      }
      onChange([...value, ...urls])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const canMention = mentionStyle !== 'none' && Boolean(onInsertMention)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => {
          const token = formatMention(mentionStyle, i + 1)
          return (
            <div
              key={`${url}-${i}`}
              className="group relative w-[88px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)]"
            >
              <div className="relative h-20 w-full">
                {/\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
                  <video src={url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded bg-white/90 px-1.5 text-xs text-[var(--text)] shadow opacity-0 transition group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
              {canMention && token && (
                <button
                  type="button"
                  disabled={disabled}
                  title={`プロンプトに ${token} を挿入`}
                  onClick={() => onInsertMention?.(token)}
                  className="w-full border-t border-[var(--border)] bg-[var(--bg-elevated)] px-1 py-1 text-center font-mono text-[10px] font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
                >
                  {token}
                </button>
              )}
            </div>
          )
        })}
        {value.length < maxItems && (
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            {uploading ? '…' : '+ Add'}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={maxItems > 1}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <p className="text-[11px] text-[var(--text-muted)]">
        {value.length}/{maxItems} · File Upload API（24h 有効）
        {canMention && ' · チップを押すとプロンプトへ挿入'}
      </p>
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  )
}
