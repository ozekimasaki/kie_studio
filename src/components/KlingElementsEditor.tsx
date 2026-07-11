import { useRef, useState } from 'react'
import { LoaderCircle, Plus, X } from 'lucide-react'
import { uploadFile } from '../lib/api.ts'
import type { KlingElement } from '../lib/models/types.ts'

function emptyElement(index: number): KlingElement {
  return {
    name: `element_${index + 1}`,
    description: '',
    element_input_urls: [],
  }
}

export function KlingElementsEditor({
  value,
  onChange,
  maxItems = 3,
  disabled,
  onInsertMention,
}: {
  value: KlingElement[]
  onChange: (next: KlingElement[]) => void
  maxItems?: number
  disabled?: boolean
  onInsertMention?: (token: string) => void
}) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function update(index: number, patch: Partial<KlingElement>) {
    onChange(value.map((el, i) => (i === index ? { ...el, ...patch } : el)))
  }

  async function addImages(index: number, files: FileList | null) {
    if (!files?.length) return
    const el = value[index]
    if (!el) return
    setError(null)
    setUploadingKey(`${index}:img`)
    try {
      const remaining = Math.max(0, 4 - el.element_input_urls.length)
      const list = [...files].slice(0, remaining)
      const urls: string[] = []
      for (const file of list) urls.push(await uploadFile(file))
      update(index, {
        element_input_urls: [...el.element_input_urls, ...urls],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploadingKey(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">
        最大 {maxItems} 件。プロンプトでは{' '}
        <code className="rounded bg-[var(--bg)] px-1">@名前</code> で参照。画像は
        2〜4 枚推奨。
      </p>

      {value.map((el, index) => {
        const token = `@${el.name || `element_${index + 1}`}`
        const inputKey = `${index}:img`
        return (
          <div
            key={index}
            className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                Element {index + 1}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={disabled || !el.name}
                  onClick={() => onInsertMention?.(token)}
                  className="rounded-md border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40"
                >
                  {token}
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="rounded-md px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  削除
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="text-[var(--text-muted)]">name（@参照名）</span>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 font-mono text-sm outline-none focus:border-[var(--accent)]"
                  value={el.name}
                  disabled={disabled}
                  placeholder="element_dog"
                  onChange={(e) =>
                    update(index, {
                      name: e.target.value.replace(/\s+/g, '_'),
                    })
                  }
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[var(--text-muted)]">description</span>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  value={el.description}
                  disabled={disabled}
                  placeholder="dog"
                  onChange={(e) => update(index, { description: e.target.value })}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] text-[var(--text-muted)]">
                element_input_urls（{el.element_input_urls.length}/4 · 2〜4枚）
              </div>
              <div className="flex flex-wrap gap-2">
                {el.element_input_urls.map((url, ui) => (
                  <div
                    key={`${url}-${ui}`}
                    className="group relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--border)]"
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        update(index, {
                          element_input_urls: el.element_input_urls.filter(
                            (_, j) => j !== ui,
                          ),
                        })
                      }
                      className="absolute right-0.5 top-0.5 inline-flex items-center justify-center rounded bg-white/90 p-0.5 shadow-sm transition hover:text-[var(--danger)] disabled:opacity-50"
                    >
                      <X size={10} strokeWidth={2.5} aria-hidden />
                    </button>
                  </div>
                ))}
                {el.element_input_urls.length < 4 && (
                  <button
                    type="button"
                    disabled={disabled || uploadingKey === inputKey}
                    onClick={() => fileRefs.current[inputKey]?.click()}
                    className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                  >
                    {uploadingKey === inputKey ? (
                      <LoaderCircle
                        size={16}
                        strokeWidth={2}
                        className="animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <Plus size={16} strokeWidth={2} aria-hidden />
                    )}
                  </button>
                )}
              </div>
              <input
                ref={(node) => {
                  fileRefs.current[inputKey] = node
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addImages(index, e.target.files)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        )
      })}

      {value.length < maxItems && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, emptyElement(value.length)])}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Plus size={16} strokeWidth={2} aria-hidden />
          Element を追加
        </button>
      )}

      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
    </div>
  )
}
