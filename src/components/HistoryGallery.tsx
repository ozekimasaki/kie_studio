import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Ellipsis,
  Pin,
  Plus,
  Play,
  RotateCcw,
  Video,
  X,
} from 'lucide-react'
import { isAudioUrl, isVideoUrl } from '../lib/media.ts'
import {
  mediaExpiryAt,
  mediaExpiryCardLabel,
  type MediaExpiry,
} from '../lib/mediaExpiry.ts'
import type { HistoryItem, MediaAsset, QuickAction, TaskState } from '../lib/models/types.ts'
import { Pressable, PressableDiv } from './motion/Pressable.tsx'
import { SharedMedia } from './motion/SharedMedia.tsx'
import { useAudioPlayer } from './audio/audioPlayerContext.ts'

const HistorySheets = lazy(() =>
  import('./HistorySheets.tsx').then((module) => ({
    default: module.HistorySheets,
  })),
)

function successExpiry(item: HistoryItem): MediaExpiry | null {
  if (
    item.state !== 'success' ||
    !((item.media?.length ?? 0) || (item.resultUrls?.length ?? 0))
  ) return null
  const expiresAt = item.expiresAt ?? item.media?.find((asset) => asset.expiresAt)?.expiresAt
  return expiresAt ? mediaExpiryAt(expiresAt) : null
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
    case 'partial':
      return '一部成功'
    case 'expired':
      return '期限切れ'
    case 'generating':
      return '生成中'
    case 'queuing':
      return 'キュー'
    case 'waiting':
      return 'API受付済み'
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

function canReuse(item: HistoryItem): boolean {
  return Boolean(item.input && item.modelId)
}

type StateFilter = 'all' | 'success' | 'fail' | 'busy'
type CategoryFilter = 'context' | 'all' | 'image' | 'video' | 'audio'

const MAX_COMPARE = 4
const HISTORY_PAGE_SIZE = 48

const smallBtnClass = 'studio-btn'
const filterSelectClass = 'studio-select w-auto max-w-none px-2 py-1.5 text-xs'

function DeferredVideo({
  src,
  poster,
  fallbackLabel,
  className,
}: {
  src: string
  poster?: string
  fallbackLabel: string
  className: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || nearViewport) return
    if (!('IntersectionObserver' in window)) {
      setNearViewport(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setNearViewport(true)
        observer.disconnect()
      },
      { rootMargin: '300px' },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [nearViewport])

  const mediaVisible = Boolean(poster) || loaded

  return (
    <div className={`${className} relative`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--accent-soft)] p-3 text-center text-[var(--text-muted)]">
        <Video size={20} aria-hidden />
        <span className="line-clamp-2 text-[10px] font-medium">
          {failed ? 'プレビューを表示できません' : fallbackLabel}
        </span>
      </div>
      <video
        ref={videoRef}
        src={nearViewport ? src : undefined}
        poster={poster}
        muted
        playsInline
        preload={nearViewport ? 'metadata' : 'none'}
        aria-label={fallbackLabel}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ${mediaVisible && !failed ? 'opacity-100' : 'opacity-0'}`}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget
          if (Number.isFinite(video.duration) && video.duration > 0.1) {
            video.currentTime = 0.1
          }
        }}
        onLoadedData={() => setLoaded(true)}
        onSeeked={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function HistoryGallery({
  items,
  activeCategory,
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
  onUpdateItem,
  onQuickAction,
}: {
  items: HistoryItem[]
  activeCategory: 'image' | 'video' | 'audio'
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
  onUpdateItem: (item: HistoryItem) => void
  onQuickAction: (
    item: HistoryItem,
    media: MediaAsset,
    action: QuickAction,
    options?: Record<string, unknown>,
  ) => void
}) {
  const audioPlayer = useAudioPlayer()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('context')
  const [modelFilter, setModelFilter] = useState<string>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE)
  const [sheetsRequested, setSheetsRequested] = useState(false)

  const effectiveCategory = categoryFilter === 'context'
    ? activeCategory
    : categoryFilter

  const modelOptions = useMemo(
    () => [...new Set(items
      .filter((item) => effectiveCategory === 'all' || item.category === effectiveCategory)
      .map((item) => item.model))],
    [effectiveCategory, items],
  )
  const effectiveModelFilter = modelOptions.includes(modelFilter)
    ? modelFilter
    : 'all'

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.taskId, item])),
    [items],
  )
  const active = (activeTaskId ? itemById.get(activeTaskId) : null) ?? null
  const showViewer = Boolean(
    active &&
      (isBusyState(active.state) ||
        active.state === 'fail' ||
        active.state === 'unknown' ||
        (active.media?.length ?? 0) > 0 ||
        (active.resultUrls?.length ?? 0) > 0),
  )

  const filtered = useMemo(() => {
    const list = items.filter((h) => {
      if (effectiveCategory !== 'all' && h.category !== effectiveCategory) {
        return false
      }
      if (effectiveModelFilter !== 'all' && h.model !== effectiveModelFilter) return false
      switch (stateFilter) {
        case 'success':
          return h.state === 'success' || h.state === 'partial'
        case 'fail':
          return h.state === 'fail' || h.state === 'expired'
        case 'busy':
          return isBusyState(h.state)
        case 'all':
          return true
        default: {
          const exhaustive: never = stateFilter
          return exhaustive
        }
      }
    })
    // ピン留めを先頭に表示（同グループ内は createdAt 降順）
    return list.toSorted((a, b) => {
      const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      if (pinDiff !== 0) return pinDiff
      return (b.createdAt ?? 0) - (a.createdAt ?? 0)
    })
  }, [effectiveCategory, effectiveModelFilter, items, stateFilter])

  const validCompareIds = useMemo(
    () => compareIds.filter((id) => itemById.has(id)),
    [compareIds, itemById],
  )
  const compareItems = useMemo(
    () =>
      validCompareIds
        .map((id) => itemById.get(id))
        .filter((h): h is HistoryItem => Boolean(h)),
    [itemById, validCompareIds],
  )
  const compareIdSet = useMemo(
    () => new Set(validCompareIds),
    [validCompareIds],
  )
  const visibleItems = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  )

  useEffect(() => {
    if (!showCompare) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowCompare(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showCompare])

  useEffect(() => {
    if (showViewer || showCompare) setSheetsRequested(true)
  }, [showCompare, showViewer])

  function toggleCompare(taskId: string) {
    setCompareIds((prev) => {
      const current = prev.filter((id) => itemById.has(id))
      if (current.includes(taskId)) {
        return current.filter((id) => id !== taskId)
      }
      if (current.length >= MAX_COMPARE) return current
      return [...current, taskId]
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
                生成メディアには保存期限があります。期限が不明なものも早めに保存してください
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
            onChange={(e) => {
              setCategoryFilter(e.target.value as CategoryFilter)
              setVisibleCount(HISTORY_PAGE_SIZE)
            }}
            aria-label="カテゴリで絞り込み"
            className={filterSelectClass}
          >
            <option value="context">
              作業中: {activeCategory === 'image' ? '画像' : activeCategory === 'video' ? '動画' : '音声'}
            </option>
            <option value="all">全カテゴリ</option>
            <option value="image">画像</option>
            <option value="video">動画</option>
            <option value="audio">音声</option>
          </select>
          <select
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value as StateFilter)
              setVisibleCount(HISTORY_PAGE_SIZE)
            }}
            aria-label="状態で絞り込み"
            className={filterSelectClass}
          >
            <option value="all">全状態</option>
            <option value="success">成功</option>
            <option value="fail">失敗</option>
            <option value="busy">生成中</option>
          </select>
          <select
            value={effectiveModelFilter}
            onChange={(e) => {
              setModelFilter(e.target.value)
              setVisibleCount(HISTORY_PAGE_SIZE)
            }}
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
            {visibleItems.map((h) => {
              const selected = h.taskId === activeTaskId
              const comparing = compareIdSet.has(h.taskId)
              const primaryMedia = h.media?.[0]
              const mediaUrl = primaryMedia?.url ?? primaryMedia?.streamUrl ?? h.resultUrls?.[0]
              const thumb = primaryMedia?.previewUrl ?? mediaUrl
              const audioTracks = (h.media ?? []).filter((asset) => asset.kind === 'audio')
              const isAudio = primaryMedia?.kind === 'audio'
                || h.category === 'audio'
                || Boolean(mediaUrl && isAudioUrl(mediaUrl))
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
                        {thumb && !isAudio ? (
                          primaryMedia?.kind === 'video' ||
                          h.category === 'video' ||
                          isVideoUrl(mediaUrl ?? thumb) ? (
                            <DeferredVideo
                              src={mediaUrl ?? thumb}
                              poster={primaryMedia?.previewUrl && !isVideoUrl(primaryMedia.previewUrl) ? primaryMedia.previewUrl : undefined}
                              fallbackLabel={h.prompt || shortModel(h.model)}
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
                        ) : isAudio && !busy ? (
                          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--accent-soft)] p-4 text-center">
                            {primaryMedia?.previewUrl ? (
                              <img src={primaryMedia.previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
                            ) : null}
                            <span className="relative grid size-12 place-items-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-lg">
                              <Play size={20} fill="currentColor" />
                            </span>
                            <span className="relative line-clamp-2 text-xs font-semibold">
                              {primaryMedia?.title ?? h.prompt ?? '生成オーディオ'}
                            </span>
                            {audioTracks.length > 1 && (
                              <span className="relative text-[10px] text-[var(--text-muted)]">{audioTracks.length}候補</span>
                            )}
                          </div>
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
                              {expiry ? (
                                <span
                                  className={`font-semibold ${expiryTextClass(expiry.status)}`}
                                >
                                  {mediaExpiryCardLabel(expiry)}
                                </span>
                              ) : h.state === 'success' ? (
                                <span className="font-semibold">早めに保存</span>
                              ) : null}
                              {typeof h.creditsConsumed === 'number' && (
                                <span>−{h.creditsConsumed}</span>
                              )}
                            </span>
                          </div>
                        </div>

                        <span className="absolute left-2 top-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                          {h.category === 'image' ? '画像' : h.category === 'video' ? '動画' : '音声'}
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
                              validCompareIds.indexOf(h.taskId) + 1
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
                      {isAudio && audioTracks.length > 0 && (
                        <Pressable
                          title="再生"
                          aria-label="再生"
                          onClick={() => audioPlayer.play(
                            audioTracks[0] as typeof audioTracks[number] & { taskId?: string },
                            audioTracks,
                          )}
                          scaleTo={0.96}
                          className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] hover:text-[var(--accent)]"
                        >
                          <Play size={14} fill="currentColor" aria-hidden />
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
          {visibleItems.length < filtered.length && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                className="studio-btn"
                onClick={() =>
                  setVisibleCount((count) => count + HISTORY_PAGE_SIZE)
                }
              >
                さらに表示（残り {filtered.length - visibleItems.length} 件）
              </button>
            </div>
          )}
        </div>
      )}

      {sheetsRequested && (
        <Suspense fallback={null}>
          <HistorySheets
            active={active}
            showViewer={showViewer}
            compareItems={compareItems}
            showCompare={showCompare}
            retryDisabled={retryDisabled}
            onCloseViewer={onClose}
            onCloseCompare={() => setShowCompare(false)}
            onReuse={onReuse}
            onRetry={onRetry}
            onSendToInput={onSendToInput}
            items={items}
            onUpdateItem={onUpdateItem}
            onQuickAction={onQuickAction}
          />
        </Suspense>
      )}
    </section>
  )
}
