import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  Ellipsis,
  Pin,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { fetchDownloadUrl } from '../lib/api.ts'
import { isVideoUrl } from '../lib/media.ts'
import {
  mediaExpiry,
  mediaExpiryCardLabel,
  mediaExpiryViewerLabel,
  type MediaExpiry,
} from '../lib/mediaExpiry.ts'
import type { HistoryItem, TaskState } from '../lib/models/types.ts'
import { Pressable, PressableDiv } from './motion/Pressable.tsx'
import { SharedMedia } from './motion/SharedMedia.tsx'
import { SpringSheet } from './motion/SpringSheet.tsx'

function successExpiry(item: HistoryItem): MediaExpiry | null {
  if (item.state !== 'success' || !(item.resultUrls?.length ?? 0)) return null
  return mediaExpiry(item.createdAt)
}

function expiryTextClass(status: MediaExpiry['status']): string {
  switch (status) {
    case 'expired':
      return 'text-[var(--danger)]'
    case 'soon':
      return 'text-[var(--warning)]'
    case 'ok':
      return 'text-white/70'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

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

const smallBtnClass = 'studio-btn'
const filterSelectClass = 'studio-select w-auto max-w-none px-2 py-1.5 text-xs'

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
  const activeExpiry = active ? successExpiry(active) : null
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

  const filtered = useMemo(() => {
    const list = items.filter((h) => {
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
    })
    // ピン留めを先頭に表示（同グループ内は createdAt 降順）
    return [...list].sort((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
  }, [items, categoryFilter, modelFilter, stateFilter])

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
    closeBtnRef.current?.focus()
  }, [showViewer])

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
      <div className="gallery-toolbar flex flex-wrap items-start justify-between gap-3 px-0 py-2">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-[0.9375rem] font-bold text-[var(--text)]">
            ギャラリー
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {items.length === 0
              ? 'まだ生成がありません'
              : pendingCount > 0
                ? `${items.length} 件 · ${pendingCount} 件生成中`
                : `${items.length} 件（ピン留めは上限まで保持）`}
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-1.5">
          {(items.length > 1 || compareMode) && (
            <Pressable
              onClick={() =>
                compareMode ? exitCompareMode() : setCompareMode(true)
              }
              aria-pressed={compareMode}
              className={`${smallBtnClass} ${
                compareMode ? 'border-[var(--accent)] text-[var(--accent)]' : ''
              }`}
              scaleTo={0.96}
            >
              {compareMode ? '比較を終了' : '比較'}
            </Pressable>
          )}
          <details className="relative">
            <summary
              className={`${smallBtnClass} list-none [&::-webkit-details-marker]:hidden`}
              aria-label="その他の操作"
            >
              <Ellipsis size={14} strokeWidth={2} aria-hidden />
            </summary>
            <div className="absolute right-0 z-[var(--z-dropdown)] mt-1 min-w-36 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-context)]">
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onExport}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--accent-soft)]"
                >
                  書き出し
                </button>
              )}
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="block w-full px-3 py-2 text-left text-xs hover:bg-[var(--accent-soft)]"
              >
                読み込み
              </button>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="block w-full px-3 py-2 text-left text-xs text-[var(--danger)] hover:bg-[var(--accent-soft)]"
                >
                  すべて削除
                </button>
              )}
              <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-snug text-[var(--text-muted)]">
                生成メディアは kie.ai 側で約14日で削除されます
              </p>
            </div>
          </details>
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
            className={filterSelectClass}
          >
            <option value="all">全カテゴリ</option>
            <option value="image">画像</option>
            <option value="video">動画</option>
          </select>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}
            aria-label="状態で絞り込み"
            className={filterSelectClass}
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
            className={`${filterSelectClass} max-w-44`}
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
        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2">
          <span className="text-xs text-[var(--text)]">
            比較する項目を選択（最大 {MAX_COMPARE} 件）:{' '}
            <span className="font-semibold tabular-nums">
              {compareItems.length} 件選択中
            </span>
          </span>
          <button
            type="button"
            disabled={compareItems.length < 2}
            onClick={() => setShowCompare(true)}
            className="studio-btn-primary w-auto cursor-pointer px-3 py-1.5 text-xs disabled:opacity-50"
          >
            並べて比較
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <div className="max-w-sm">
            <p className="studio-empty-title">まだ何もありません</p>
            <p className="studio-empty-body">
              左のフォームから生成すると、ここに並びます
            </p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center">
          <p className="studio-empty-body">
            絞り込み条件に一致する履歴がありません
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((h) => {
              const selected = h.taskId === activeTaskId
              const comparing = compareIds.includes(h.taskId)
              const thumb = h.resultUrls?.[0]
              const busy = isBusyState(h.state)
              const expiry = successExpiry(h)

              return (
                <div
                  key={h.taskId}
                  className={`studio-tile group flex flex-col ${
                    compareMode && comparing
                      ? 'is-selected'
                      : selected && !compareMode
                        ? 'is-selected'
                        : ''
                  }`}
                >
                  <PressableDiv
                    className="relative"
                    scaleTo={0.96}
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
                      <SharedMedia
                        layoutId={`media-${h.taskId}`}
                        className="relative aspect-square overflow-hidden bg-[var(--bg-elevated)]"
                      >
                        {thumb ? (
                          isVideoUrl(thumb) ? (
                            <video
                              src={thumb}
                              muted
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img
                              src={thumb}
                              alt={h.prompt || shortModel(h.model)}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          )
                        ) : busy ? (
                          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--accent-soft)] p-3">
                            <div className="relative">
                              <div className="studio-spinner size-9 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
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

                        {expiry?.status === 'expired' && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center studio-tile-scrim px-2">
                            <span className="rounded-[var(--radius-sm)] bg-[var(--text)] px-2 py-1 text-center text-[10px] font-semibold text-[var(--on-accent)]">
                              期限切れの可能性
                            </span>
                          </div>
                        )}

                        <div className="pointer-events-none absolute inset-x-0 bottom-0 studio-tile-scrim p-2">
                          <div className="truncate text-[11px] font-medium text-white">
                            {shortModel(h.model)}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-white/80 tabular-nums">
                            <span>{relativeTime(h.createdAt)}</span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              {expiry && (
                                <span
                                  className={`font-semibold ${expiryTextClass(expiry.status)}`}
                                >
                                  {mediaExpiryCardLabel(expiry)}
                                </span>
                              )}
                              {typeof h.creditsConsumed === 'number' && (
                                <span>−{h.creditsConsumed}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <span className="absolute left-2 top-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                          {h.category === 'image' ? '画像' : '動画'}
                        </span>

                        {compareMode && (
                          <span
                            className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-xs font-bold tabular-nums ${
                              comparing
                                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                                : 'border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                            }`}
                          >
                            {comparing ? (
                              compareIds.indexOf(h.taskId) + 1
                            ) : (
                              <Plus size={12} strokeWidth={2.5} aria-hidden />
                            )}
                          </span>
                        )}
                      </SharedMedia>
                    </button>
                  </PressableDiv>

                  {!compareMode && (
                    <div className="flex items-center gap-0.5 border-t border-[var(--border)] bg-[var(--surface-raised)] px-1 py-1">
                      <Pressable
                        title={h.pinned ? 'ピンを外す' : 'ピン留め'}
                        aria-label={h.pinned ? 'ピンを外す' : 'ピン留め'}
                        aria-pressed={Boolean(h.pinned)}
                        onClick={() => onTogglePin(h.taskId)}
                        scaleTo={0.96}
                        className={`rounded-[var(--radius-sm)] p-1.5 ${
                          h.pinned
                            ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--accent)]'
                        }`}
                      >
                        <Pin
                          size={14}
                          strokeWidth={2}
                          aria-hidden
                          fill={h.pinned ? 'currentColor' : 'none'}
                        />
                      </Pressable>
                      {canReuse(h) && (
                        <Pressable
                          title="この入力をフォームに復元"
                          aria-label="この入力をフォームに復元"
                          onClick={() => onReuse(h)}
                          scaleTo={0.96}
                          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)]"
                        >
                          <RotateCcw size={14} strokeWidth={2} aria-hidden />
                        </Pressable>
                      )}
                      {h.state === 'fail' && canReuse(h) && (
                        <Pressable
                          disabled={retryDisabled}
                          onClick={() => onRetry(h)}
                          scaleTo={0.96}
                          className="rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-semibold text-[var(--danger)] disabled:opacity-50"
                        >
                          再実行
                        </Pressable>
                      )}
                      <Pressable
                        title="削除"
                        aria-label="削除"
                        onClick={() => onRemove(h.taskId)}
                        scaleTo={0.96}
                        className="ml-auto rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)]"
                      >
                        <X size={14} strokeWidth={2} aria-hidden />
                      </Pressable>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <SpringSheet
        open={Boolean(showViewer && active)}
        onClose={onClose}
        labelledBy="viewer-title"
      >
        {active && (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <div
                  id="viewer-title"
                  className="truncate text-lg font-bold"
                >
                  {shortModel(active.model)}
                  {active.pinned && (
                    <span
                      className="ml-2 inline-flex align-middle text-[var(--accent)]"
                      title="ピン留め済み"
                    >
                      <Pin
                        size={14}
                        strokeWidth={2}
                        aria-hidden
                        fill="currentColor"
                      />
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-[var(--text-muted)]">
                  {fullPrompt(active) || active.taskId}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {canReuse(active) && (
                  <Pressable
                    onClick={() => onReuse(active)}
                    className={`${smallBtnClass} inline-flex items-center gap-1`}
                    title="この入力をフォームに復元"
                    scaleTo={0.96}
                  >
                    <RotateCcw size={14} strokeWidth={2} aria-hidden />
                    再利用
                  </Pressable>
                )}
                <Pressable
                  ref={closeBtnRef}
                  className={smallBtnClass}
                  onClick={onClose}
                  scaleTo={0.96}
                  data-sheet-initial-focus="true"
                >
                  閉じる
                </Pressable>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto bg-[var(--bg)] p-5">
              {isBusyState(active.state) && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <div className="studio-spinner size-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
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
                    <Pressable
                      disabled={retryDisabled}
                      onClick={() => onRetry(active)}
                      className="studio-btn-primary mx-auto w-auto px-4 py-2 text-xs disabled:opacity-50"
                      scaleTo={0.97}
                    >
                      同じ入力で再実行
                    </Pressable>
                  )}
                </div>
              )}
              {active.state === 'unknown' && (
                <p className="py-10 text-center text-sm text-[var(--warning)]">
                  状態を取得できませんでした
                </p>
              )}
              {active.state === 'success' &&
                (active.resultUrls ?? []).map((url, index) => (
                  <div key={url} className="space-y-3">
                    <SharedMedia
                      layoutId={index === 0 ? `media-${active.taskId}` : `media-${active.taskId}-${index}`}
                      className="studio-tile overflow-hidden"
                    >
                      {isVideoUrl(url) ? (
                        <video
                          src={url}
                          controls
                          preload="metadata"
                          className="mx-auto max-h-[55vh] w-full bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={url}
                          alt={active.prompt || '生成結果'}
                          decoding="async"
                          className="mx-auto max-h-[55vh] w-full object-contain"
                        />
                      )}
                    </SharedMedia>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className={smallBtnClass}
                      >
                        開く
                      </a>
                      <Pressable
                        disabled={download.isPending}
                        onClick={() => download.mutate(url)}
                        className={smallBtnClass}
                        scaleTo={0.96}
                      >
                        {download.isPending ? '取得中…' : 'API でダウンロード'}
                      </Pressable>
                      <Pressable
                        onClick={() => onSendToInput(url)}
                        title="この結果を左フォームの参照入力に追加"
                        className={`${smallBtnClass} inline-flex items-center gap-1`}
                        scaleTo={0.96}
                      >
                        <ArrowRight size={14} strokeWidth={2} aria-hidden />
                        入力に使う
                      </Pressable>
                      {typeof active.creditsConsumed === 'number' && (
                        <span className="ml-auto self-center text-xs text-[var(--text-muted)]">
                          使用{' '}
                          <span className="font-semibold text-[var(--danger)]">
                            −{active.creditsConsumed}
                          </span>
                        </span>
                      )}
                    </div>
                    {index === 0 && activeExpiry && (
                      <p
                        className={`text-xs ${
                          activeExpiry.status === 'ok'
                            ? 'text-[var(--text-muted)]'
                            : activeExpiry.status === 'soon'
                              ? 'text-[var(--warning)]'
                              : 'text-[var(--danger)]'
                        }`}
                      >
                        {mediaExpiryViewerLabel(activeExpiry)}
                      </p>
                    )}
                    {download.isError && (
                      <p className="studio-field-error">
                        {(download.error as Error).message ||
                          'ダウンロード URL の取得に失敗しました'}
                      </p>
                    )}
                  </div>
                ))}

              {fullPrompt(active) && (
                <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="studio-label">プロンプト</span>
                    <Pressable
                      onClick={() => void copyPrompt(fullPrompt(active)!)}
                      className={`${smallBtnClass} text-[11px]`}
                      scaleTo={0.96}
                    >
                      {copied ? (
                        <>
                          <span role="status" aria-live="polite">
                            コピーしました
                          </span>
                          <Check size={12} strokeWidth={2.5} aria-hidden />
                        </>
                      ) : (
                        'コピー'
                      )}
                    </Pressable>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--text)]">
                    {fullPrompt(active)}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SpringSheet>

      <SpringSheet
        open={showCompare && compareItems.length >= 2}
        onClose={() => setShowCompare(false)}
        label="生成結果の比較"
        maxWidthClass="max-w-6xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="text-lg font-bold tabular-nums">
            比較（{compareItems.length} 件）
          </div>
          <Pressable
            className={smallBtnClass}
            onClick={() => setShowCompare(false)}
            scaleTo={0.96}
          >
            閉じる
          </Pressable>
        </div>
        <div className="max-h-[82vh] overflow-y-auto p-4">
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:grid sm:overflow-visible sm:pb-0 sm:[grid-template-columns:repeat(var(--compare-cols),minmax(0,1fr))]"
            style={
              {
                '--compare-cols': String(compareItems.length),
              } as CSSProperties
            }
          >
            {compareItems.map((h) => {
              const url = h.resultUrls?.[0]
              return (
                <div
                  key={h.taskId}
                  className="studio-tile flex w-[min(80vw,280px)] shrink-0 snap-center flex-col gap-2 p-2 sm:w-auto sm:min-w-0"
                >
                  <div className="overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg)]">
                    {url ? (
                      isVideoUrl(url) ? (
                        <video
                          src={url}
                          controls
                          muted
                          preload="metadata"
                          className="aspect-square w-full bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={url}
                          alt={h.prompt || shortModel(h.model)}
                          loading="lazy"
                          decoding="async"
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
                      <Pressable
                        onClick={() => {
                          exitCompareMode()
                          onReuse(h)
                        }}
                        className={`${smallBtnClass} w-full`}
                        scaleTo={0.97}
                      >
                        <RotateCcw size={12} strokeWidth={2} aria-hidden />
                        この入力を再利用
                      </Pressable>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SpringSheet>
    </section>
  )
}
