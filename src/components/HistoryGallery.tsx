import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { fetchDownloadUrl } from '../lib/api.ts'
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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('video')
}

function shortModel(model: string): string {
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function isBusyState(state: TaskState): boolean {
  return state === 'waiting' || state === 'queuing' || state === 'generating'
}

export function HistoryGallery({
  items,
  activeTaskId,
  pendingCount = 0,
  onSelect,
  onClose,
  onRemove,
  onClear,
}: {
  items: HistoryItem[]
  activeTaskId?: string | null
  pendingCount?: number
  onSelect: (item: HistoryItem) => void
  onClose: () => void
  onRemove: (taskId: string) => void
  onClear: () => void
}) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const active = items.find((h) => h.taskId === activeTaskId) ?? null
  const showViewer = Boolean(
    active &&
      (isBusyState(active.state) ||
        active.state === 'fail' ||
        active.state === 'unknown' ||
        (active.resultUrls?.length ?? 0) > 0),
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

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">ギャラリー</h2>
          <p className="text-xs text-[var(--text-muted)]">
            {items.length === 0
              ? 'まだ生成がありません'
              : pendingCount > 0
                ? `${items.length} 件 · ${pendingCount} 件生成中`
                : `${items.length} 件（最大 30）`}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            すべて削除
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg)] px-6 py-16 text-center">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">履歴ギャラリー</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              左のフォームから生成すると、ここに並びます
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {items.map((h) => {
              const selected = h.taskId === activeTaskId
              const thumb = h.resultUrls?.[0]
              const busy = isBusyState(h.state)

              return (
                <div
                  key={h.taskId}
                  className={`relative overflow-hidden rounded-2xl border bg-[var(--bg)] transition ${
                    selected
                      ? 'border-[var(--accent)] shadow-md ring-2 ring-[var(--accent)]/20'
                      : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-sm'
                  }`}
                >
                  <button
                    type="button"
                    className="block w-full text-left"
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(h)}
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
                    </div>
                  </button>

                  <button
                    type="button"
                    title="削除"
                    aria-label="削除"
                    onClick={() => onRemove(h.taskId)}
                    className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-xs text-[var(--text-muted)] shadow-sm transition hover:text-[var(--danger)]"
                  >
                    ×
                  </button>
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
                </div>
                <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                  {active.prompt || active.taskId}
                </div>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={onClose}
              >
                閉じる
              </button>
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
                <div className="space-y-2 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--danger)]">
                    生成に失敗しました
                  </p>
                  {active.failMsg && (
                    <p className="mx-auto max-w-md text-xs text-[var(--text-muted)]">
                      {active.failMsg}
                    </p>
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
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
