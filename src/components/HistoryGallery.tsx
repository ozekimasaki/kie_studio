import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { fetchDownloadUrl } from '../lib/api.ts'
import { isVideoUrl } from '../lib/media.ts'
import type { HistoryItem, TaskState } from '../lib/models/types.ts'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'たった今'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}日前`
  return new Date(ts).toLocaleDateString()
}

function stateLabel(state: TaskState): string {
  switch (state) {
    case 'success':
      return '成功'
    case 'fail':
      return '失敗'
    case 'generating':
      return '生成中'
    case 'queuing':
      return 'キュー'
    case 'waiting':
      return '待機'
    case 'unknown':
      return '状態不明'
    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}

function shortModel(model: string): string {
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function isBusyState(state: TaskState): boolean {
  return state === 'waiting' || state === 'queuing' || state === 'generating'
}

/** 保存済み input があれば全文、なければ切り詰め済み prompt */
function fullPrompt(item: HistoryItem): string | undefined {
  const p = item.input?.prompt
  if (typeof p === 'string' && p) return p
  return item.prompt
}

function canReuse(item: HistoryItem): boolean {
  return Boolean(item.input && item.modelId)
}

type StateFilter = 'all' | 'success' | 'fail' | 'busy'
type CategoryFilter = 'all' | 'image' | 'video'

const MAX_COMPARE = 4

const smallBtnClass =
  'rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]'

export function HistoryGallery({
  items,
  activeTaskId,
  pendingCount = 0,
  retryDisabled,
  onSelect,
  onClose,
  onRemove,
  onClear,
  onReuse,
  onRetry,
  onSendToInput,
  onTogglePin,
  onExport,
  onImport,
}: {
  items: HistoryItem[]
  activeTaskId?: string | null
  pendingCount?: number
  retryDisabled?: boolean
  onSelect: (item: HistoryItem) => void
  onClose: () => void
  onRemove: (taskId: string) => void
  onClear: () => void
  onReuse: (item: HistoryItem) => void
  onRetry: (item: HistoryItem) => void
  onSendToInput: (url: string) => void
  onTogglePin: (taskId: string) => void
  onExport: () => void
  onImport: (raw: string) => void
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [copied, setCopied] = useState(false)

  const active = items.find((h) => h.taskId === activeTaskId) ?? null
  const showViewer = Boolean(
    active &&
      (isBusyState(active.state) ||
        active.state === 'fail' ||
        active.state === 'unknown' ||
        (active.resultUrls?.length ?? 0) > 0),
  )

  const modelOptions = useMemo(
    () => [...new Set(items.map((h) => h.model))],
    [items],
  )

  const filtered = useMemo(
    () =>
      items.filter((h) => {
        if (categoryFilter !== 'all' && h.category !== categoryFilter) {
          return false
        }
        if (modelFilter !== 'all' && h.model !== modelFilter) return false
        switch (stateFilter) {
          case 'success':
            return h.state === 'success'
          case 'fail':
            return h.state === 'fail'
          case 'busy':
            return isBusyState(h.state)
          default:
            return true
        }
      }),
    [items, categoryFilter, modelFilter, stateFilter],
  )

  const compareItems = useMemo(
    () =>
      compareIds
        .map((id) => items.find((h) => h.taskId === id))
        .filter((h): h is HistoryItem => Boolean(h)),
    [compareIds, items],
  )

  const download = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetchDownloadUrl(url)
      window.open(res.data.downloadUrl, '_blank', 'noopener,noreferrer')
    },
  })

  useEffect(() => {
    if (!showViewer) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    closeBtnRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [showViewer, onClose])

  useEffect(() => {
    if (!showCompare) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowCompare(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCompare])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  // 削除・押し出しで消えたアイテムを比較選択から除去する
  useEffect(() => {
    setCompareIds((prev) => {
      const next = prev.filter((id) => items.some((h) => h.taskId === id))
      return next.length === prev.length ? prev : next
    })
  }, [items])

  function toggleCompare(taskId: string) {
    setCompareIds((prev) => {
      if (prev.includes(taskId)) return prev.filter((id) => id !== taskId)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, taskId]
    })
  }

  function exitCompareMode() {
    setCompareMode(false)
    setCompareIds([])
    setShowCompare(false)
  }

  async function handleImportFile(file: File) {
    onImport(await file.text())
  }

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      window.prompt('コピーできませんでした。手動でコピーしてください:', text)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">ギャラリー</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {items.length === 0
              ? 'まだ生成がありません'
              : pendingCount > 0
                ? `${items.length} 件 · ${pendingCount} 件生成中`
                : `${items.length} 件（ピン留めは押し出されません）`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(items.length > 1 || compareMode) && (
            <button
              type="button"
              onClick={() =>
                compareMode ? exitCompareMode() : setCompareMode(true)
              }
              aria-pressed={compareMode}
              className={`${smallBtnClass} ${
                compareMode
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : ''
              }`}
            >
              {compareMode ? '比較を終了' : '比較'}
            </button>
          )}
          {items.length > 0 && (
            <button type="button" onClick={onExport} className={smallBtnClass}>
              書き出し
            </button>
          )}
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className={smallBtnClass}
          >
            読み込み
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="履歴 JSON を読み込み"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
              e.target.value = ''
            }}
          />
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className={`${smallBtnClass} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
            >
              すべて削除
            </button>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as CategoryFilter)
            }
            aria-label="カテゴリで絞り込み"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="all">全カテゴリ</option>
            <option value="image">IMAGE</option>
            <option value="video">VIDEO</option>
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            aria-label="状態で絞り込み"
            className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="all">全状態</option>
            <option value="success">成功</option>
            <option value="fail">失敗</option>
            <option value="busy">生成中</option>
          </select>
          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            aria-label="モデルで絞り込み"
            className="max-w-44 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 outline-none focus:border-[var(--accent)]"
          >
            <option value="all">全モデル</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {shortModel(m)}
              </option>
            ))}
          </select>
          {filtered.length !== items.length && (
            <span className="text-[var(--text-muted)]">
              {filtered.length} / {items.length} 件を表示
            </span>
          )}
        </div>
      )}

      {compareMode && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2">
          <span className="text-xs text-[var(--text)]">
            比較するカードを選択（最大 {MAX_COMPARE} 件）:{' '}
            <span className="font-semibold">{compareItems.length} 件選択中</span>
          </span>
          <button
            type="button"
            disabled={compareItems.length < 2}
            onClick={() => setShowCompare(true)}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            並べて比較
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-6 py-16 text-center">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">履歴ギャラリー</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              左のフォームから生成すると、ここに並びます
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-6 py-16 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            絞り込み条件に一致する履歴がありません
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((h) => {
              const selected = h.taskId === activeTaskId
              const comparing = compareIds.includes(h.taskId)
              const thumb = h.resultUrls?.[0]
              const busy = isBusyState(h.state)

              return (
                <div
                  key={h.taskId}
                  className={`relative overflow-hidden rounded-2xl border bg-[var(--bg)] transition ${
                    compareMode && comparing
                      ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40'
                      : selected && !compareMode
                        ? 'border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/20'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    aria-current={selected ? 'true' : undefined}
                    aria-pressed={compareMode ? comparing : undefined}
                    onClick={() =>
                      compareMode ? toggleCompare(h.taskId) : onSelect(h)
                    }
                  >
                    <div className="relative aspect-square overflow-hidden bg-[var(--bg-elevated)]">
                      {thumb ? (
                        isVideoUrl(thumb) ? (
                          <video
                            src={thumb}
                            muted
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <img
                            src={thumb}
                            alt={h.prompt || shortModel(h.model)}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : busy ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 bg-[linear-gradient(145deg,#eef3f9,#f8fafc)] p-3">
                          <div className="relative">
                            <div className="size-10 animate-spin rounded-full border-[3px] border-[var(--border)] border-t-[var(--accent)]" />
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-semibold text-[var(--accent)]">
                              生成中
                            </div>
                            <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                              {stateLabel(h.state)}
                            </div>
                          </div>
                        </div>
                      ) : h.state === 'fail' ? (
                        <div className="flex h-full flex-col items-center justify-center gap-1 p-3 text-center">
                          <span className="text-xs font-semibold text-[var(--danger)]">
                            失敗
                          </span>
                          {h.failMsg && (
                            <span className="line-clamp-3 text-[10px] text-[var(--text-muted)]">
                              {h.failMsg}
                            </span>
                          )}
                        </div>
                      ) : h.state === 'unknown' ? (
                        <div className="flex h-full items-center justify-center p-3 text-center text-xs text-[var(--warning)]">
                          状態不明
                        </div>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] uppercase text-[var(--text-muted)]">
                          {h.category}
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-2 pt-8">
                        <div className="truncate text-[11px] font-medium text-white">
                          {shortModel(h.model)}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-white/80">
                          <span>{relativeTime(h.createdAt)}</span>
                          {typeof h.creditsConsumed === 'number' && (
                            <span>−{h.creditsConsumed}</span>
                          )}
                        </div>
                      </div>

                      <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--text)] shadow-sm">
                        {h.category}
                      </span>

                      {compareMode && (
                        <span
                          className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                            comparing
                              ? 'bg-[var(--accent)] text-white'
                              : 'bg-white/90 text-[var(--text-muted)]'
                          }`}
                        >
                          {comparing ? compareIds.indexOf(h.taskId) + 1 : '+'}
                        </span>
                      )}
                    </div>
                  </button>

                  {!compareMode && (
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        title={h.pinned ? 'ピンを外す' : 'ピン留め'}
                        aria-label={h.pinned ? 'ピンを外す' : 'ピン留め'}
                        aria-pressed={Boolean(h.pinned)}
                        onClick={() => onTogglePin(h.taskId)}
                        className={`rounded-md px-1.5 py-0.5 text-xs shadow-sm transition ${
                          h.pinned
                            ? 'bg-[var(--accent)] text-white'
                            : 'bg-white/90 text-[var(--text-muted)] hover:text-[var(--accent)]'
                        }`}
                      >
                        📌
                      </button>
                      {canReuse(h) && (
                        <button
                          type="button"
                          title="この入力をフォームに復元"
                          aria-label="この入力をフォームに復元"
                          onClick={() => onReuse(h)}
                          className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs text-[var(--text-muted)] shadow-sm transition hover:text-[var(--accent)]"
                        >
                          ↺
                        </button>
                      )}
                      <button
                        type="button"
                        title="削除"
                        aria-label="削除"
                        onClick={() => onRemove(h.taskId)}
                        className="rounded-md bg-white/90 px-1.5 py-0.5 text-xs text-[var(--text-muted)] shadow-sm transition hover:text-[var(--danger)]"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {!compareMode && h.state === 'fail' && canReuse(h) && (
                    <button
                      type="button"
                      disabled={retryDisabled}
                      onClick={() => onRetry(h)}
                      className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-[var(--danger)] shadow-sm transition hover:brightness-95 disabled:opacity-50"
                    >
                      再実行
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showViewer && active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={onClose}
          role="presentation"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="viewer-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div id="viewer-title" className="truncate font-semibold">
                  {shortModel(active.model)}
                  {active.pinned && (
                    <span className="ml-2 text-xs" title="ピン留め済み">
                      📌
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                  {fullPrompt(active) || active.taskId}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {canReuse(active) && (
                  <button
                    type="button"
                    onClick={() => onReuse(active)}
                    className={smallBtnClass}
                    title="この入力をフォームに復元"
                  >
                    ↺ 再利用
                  </button>
                )}
                <button
                  ref={closeBtnRef}
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                  onClick={onClose}
                >
                  閉じる
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto bg-[var(--bg)] p-4">
              {isBusyState(active.state) && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="size-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {stateLabel(active.state)}…
                  </p>
                </div>
              )}
              {active.state === 'fail' && (
                <div className="space-y-3 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--danger)]">
                    生成に失敗しました
                  </p>
                  {active.failMsg && (
                    <p className="mx-auto max-w-md text-xs text-[var(--text-muted)]">
                      {active.failMsg}
                    </p>
                  )}
                  {canReuse(active) && (
                    <button
                      type="button"
                      disabled={retryDisabled}
                      onClick={() => onRetry(active)}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      同じ入力で再実行
                    </button>
                  )}
                </div>
              )}
              {active.state === 'unknown' && (
                <p className="py-10 text-center text-sm text-[var(--warning)]">
                  状態を取得できませんでした
                </p>
              )}
              {active.state === 'success' &&
                (active.resultUrls ?? []).map((url) => (
                  <div key={url} className="space-y-3">
                    {isVideoUrl(url) ? (
                      <video
                        src={url}
                        controls
                        className="mx-auto max-h-[55vh] w-full rounded-xl bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={url}
                        alt={active.prompt || '生成結果'}
                        className="mx-auto max-h-[55vh] w-full rounded-xl object-contain"
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                      >
                        開く
                      </a>
                      <button
                        type="button"
                        disabled={download.isPending}
                        onClick={() => download.mutate(url)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)] disabled:opacity-50"
                      >
                        {download.isPending
                          ? '取得中…'
                          : 'Download via API'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSendToInput(url)}
                        title="この結果を左フォームの参照入力に追加"
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:border-[var(--accent)]"
                      >
                        → 入力に使う
                      </button>
                      {typeof active.creditsConsumed === 'number' && (
                        <span className="ml-auto self-center text-xs text-[var(--text-muted)]">
                          使用{' '}
                          <span className="font-semibold text-[var(--danger)]">
                            −{active.creditsConsumed}
                          </span>
                        </span>
                      )}
                    </div>
                    {download.isError && (
                      <p className="text-xs text-[var(--danger)]">
                        {(download.error as Error).message ||
                          'ダウンロード URL の取得に失敗しました'}
                      </p>
                    )}
                  </div>
                ))}

              {fullPrompt(active) && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Prompt
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyPrompt(fullPrompt(active)!)}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                    >
                      {copied ? 'コピーしました ✓' : 'コピー'}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text)]">
                    {fullPrompt(active)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCompare && compareItems.length >= 2 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowCompare(false)}
          role="presentation"
        >
          <div
            className="relative max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="生成結果の比較"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="font-semibold">
                比較（{compareItems.length} 件）
              </div>
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setShowCompare(false)}
              >
                閉じる
              </button>
            </div>
            <div className="max-h-[82vh] overflow-y-auto p-4">
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${compareItems.length}, minmax(0, 1fr))`,
                }}
              >
                {compareItems.map((h) => {
                  const url = h.resultUrls?.[0]
                  return (
                    <div
                      key={h.taskId}
                      className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5"
                    >
                      <div className="overflow-hidden rounded-lg bg-[var(--bg-elevated)]">
                        {url ? (
                          isVideoUrl(url) ? (
                            <video
                              src={url}
                              controls
                              muted
                              className="aspect-square w-full bg-black object-contain"
                            />
                          ) : (
                            <img
                              src={url}
                              alt={h.prompt || shortModel(h.model)}
                              className="aspect-square w-full object-contain"
                            />
                          )
                        ) : (
                          <div className="flex aspect-square items-center justify-center text-xs text-[var(--text-muted)]">
                            {stateLabel(h.state)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="truncate text-xs font-semibold">
                          {shortModel(h.model)}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                          <span>{relativeTime(h.createdAt)}</span>
                          {typeof h.creditsConsumed === 'number' && (
                            <span>−{h.creditsConsumed}</span>
                          )}
                        </div>
                        {fullPrompt(h) && (
                          <p className="line-clamp-6 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--text-muted)]">
                            {fullPrompt(h)}
                          </p>
                        )}
                        {canReuse(h) && (
                          <button
                            type="button"
                            onClick={() => {
                              exitCompareMode()
                              onReuse(h)
                            }}
                            className="w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-[11px] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                          >
                            ↺ この入力を再利用
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
