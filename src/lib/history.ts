import type { HistoryItem, TaskState } from './models/types.ts'

const KEY = 'kie-studio-history'
const MAX_ITEMS = 30
const MAX_PINNED = 30

/** Matches App polling: unknown items older than this are not refetched. */
export const UNKNOWN_STALE_MS = 10 * 60 * 1000

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Keep up to MAX_PINNED pinned items (newest first) plus the newest
 * MAX_ITEMS non-pinned items. Excess pins are unpinned before the
 * non-pinned budget is applied. Pinned items don't consume the
 * non-pinned budget, so a just-submitted task is never evicted by pins.
 */
function capItems(items: HistoryItem[]): HistoryItem[] {
  let pinnedBudget = MAX_PINNED
  const withPinCap = items.map((item) => {
    if (!item.pinned) return item
    if (pinnedBudget > 0) {
      pinnedBudget--
      return item
    }
    return { ...item, pinned: false }
  })

  let nonPinnedBudget = MAX_ITEMS
  return withPinCap.filter((item) => {
    if (item.pinned) return true
    if (nonPinnedBudget > 0) {
      nonPinnedBudget--
      return true
    }
    return false
  })
}

export function saveHistory(items: HistoryItem[]) {
  const capped = capItems(items)
  const stripInput = ({ input: _input, ...rest }: HistoryItem) => rest
  // 容量超過時は input を段階的に落とす（ピン留めの input は最後まで守る）
  const attempts = [
    capped,
    capped.map((h) => (h.pinned ? h : stripInput(h))),
    capped.map(stripInput),
  ]
  for (const attempt of attempts) {
    try {
      localStorage.setItem(KEY, JSON.stringify(attempt))
      return
    } catch {
      // 次の縮小版で再試行
    }
  }
}

/** Merge into an in-memory list (avoids localStorage race on rapid updates). */
export function upsertInList(
  prev: HistoryItem[],
  item: HistoryItem,
): HistoryItem[] {
  return capItems([item, ...prev.filter((h) => h.taskId !== item.taskId)])
}

export function removeFromList(
  prev: HistoryItem[],
  taskId: string,
): HistoryItem[] {
  return prev.filter((h) => h.taskId !== taskId)
}

export type TogglePinResult = {
  next: HistoryItem[]
  rejected?: 'pin-limit'
}

export function togglePinInList(
  prev: HistoryItem[],
  taskId: string,
): TogglePinResult {
  const target = prev.find((h) => h.taskId === taskId)
  if (!target) return { next: prev }

  const willPin = !target.pinned
  if (willPin) {
    const pinnedCount = prev.filter((h) => h.pinned).length
    if (pinnedCount >= MAX_PINNED) {
      return { next: prev, rejected: 'pin-limit' }
    }
  }

  return {
    next: prev.map((h) =>
      h.taskId === taskId ? { ...h, pinned: !h.pinned } : h,
    ),
  }
}

export function exportHistoryJson(items: HistoryItem[]): string {
  return JSON.stringify(
    { app: 'kie-studio', version: 1, exportedAt: new Date().toISOString(), items },
    null,
    2,
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const urls = value.filter((u): u is string => typeof u === 'string')
  return urls.length > 0 ? urls : undefined
}

function asInput(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** Parse an exported JSON payload; throws with a user-facing message on bad input. */
export function parseHistoryJson(raw: string): HistoryItem[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('JSON として読み込めませんでした')
  }
  const items = Array.isArray(data)
    ? data
    : (data as { items?: unknown })?.items
  if (!Array.isArray(items)) {
    throw new Error('履歴データの形式が正しくありません')
  }
  const now = Date.now()
  const staleAt = now - UNKNOWN_STALE_MS
  const valid = items.flatMap((h): HistoryItem[] => {
    if (!h || typeof h !== 'object' || Array.isArray(h)) return []
    const item = h as Record<string, unknown>
    if (typeof item.taskId !== 'string' || typeof item.model !== 'string') {
      return []
    }
    if (item.category !== 'image' && item.category !== 'video') return []

    // 進行中状態は別環境のタスクをポーリングしないよう unknown に落とす。
    // createdAt も stale にしてインポート直後の fetch を防ぐ。
    const isTerminal = item.state === 'success' || item.state === 'fail'
    const state: TaskState = isTerminal
      ? (item.state as 'success' | 'fail')
      : 'unknown'
    const parsedCreatedAt = asFiniteNumber(item.createdAt) ?? now
    const createdAt = isTerminal
      ? parsedCreatedAt
      : Math.min(parsedCreatedAt, staleAt)

    const normalized: HistoryItem = {
      taskId: item.taskId,
      model: item.model,
      category: item.category,
      state,
      createdAt,
    }

    const resultUrls = asStringArray(item.resultUrls)
    if (resultUrls) normalized.resultUrls = resultUrls

    const prompt = asString(item.prompt)
    if (prompt !== undefined) normalized.prompt = prompt

    const creditsConsumed = asFiniteNumber(item.creditsConsumed)
    if (creditsConsumed !== undefined) normalized.creditsConsumed = creditsConsumed

    const failMsg = asString(item.failMsg)
    if (failMsg !== undefined) normalized.failMsg = failMsg

    const modelId = asString(item.modelId)
    if (modelId !== undefined) normalized.modelId = modelId

    const input = asInput(item.input)
    if (input) normalized.input = input

    if (item.pinned === true) normalized.pinned = true

    return [normalized]
  })
  if (valid.length === 0) {
    throw new Error('インポートできる履歴がありませんでした')
  }
  // ピン超過は capItems で newest-first に切り詰める
  return capItems(valid.sort((a, b) => b.createdAt - a.createdAt))
}

/** Merge imported items into current list (existing taskIds win), newest first. */
export function mergeHistory(
  current: HistoryItem[],
  imported: HistoryItem[],
): HistoryItem[] {
  const known = new Set(current.map((h) => h.taskId))
  const added = imported.filter((h) => !known.has(h.taskId))
  return capItems(
    [...current, ...added].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
  )
}

export function upsertHistory(item: HistoryItem): HistoryItem[] {
  const next = upsertInList(loadHistory(), item)
  saveHistory(next)
  return next
}

export function removeHistory(taskId: string): HistoryItem[] {
  const next = removeFromList(loadHistory(), taskId)
  saveHistory(next)
  return next
}

export function clearHistory(): HistoryItem[] {
  saveHistory([])
  return []
}
