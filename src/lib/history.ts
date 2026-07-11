import type { HistoryItem, TaskState } from './models/types.ts'

const KEY = 'kie-studio-history'
const MAX_ITEMS = 30
const MAX_PINNED = 30

/** Matches App polling: unknown items older than this are not refetched. */
export const UNKNOWN_STALE_MS = 10 * 60 * 1000

/** Cap for waiting/queuing/generating — stops eternal polling. */
export const PENDING_STALE_MS = 60 * 60 * 1000

const SAVE_DEBOUNCE_MS = 400

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingPersist: HistoryItem[] | null = null

/**
 * Normalize API/local timestamps to milliseconds.
 * Values below 1e12 are treated as Unix seconds.
 */
export function normalizeTimestamp(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return value < 1e12 ? value * 1000 : value
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const normalized = normalizeHistoryItems(data, 'local')
    // demote / 不正データの除去をディスクにも反映
    persistToStorage(normalized)
    return normalized
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

function persistToStorage(capped: HistoryItem[]): void {
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

function clearSaveDebounce(): void {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  pendingPersist = null
}

/** Persist to localStorage (capped). Returns the in-memory capped list for setState. */
export function saveHistory(items: HistoryItem[]): HistoryItem[] {
  clearSaveDebounce()
  const capped = capItems(items)
  persistToStorage(capped)
  return capped
}

/**
 * Cap for setState immediately; debounce localStorage writes.
 * User actions should keep using saveHistory for instant persistence.
 */
export function saveHistoryDebounced(
  items: HistoryItem[],
  delayMs = SAVE_DEBOUNCE_MS,
): HistoryItem[] {
  const capped = capItems(items)
  pendingPersist = capped
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null
    if (pendingPersist) {
      persistToStorage(pendingPersist)
      pendingPersist = null
    }
  }, delayMs)
  return capped
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
    next: prev
      .map((h) =>
        h.taskId === taskId ? { ...h, pinned: !h.pinned } : h,
      )
      // ピン留めを先頭に（同グループ内は相対順を維持）
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))),
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

type NormalizeMode = 'local' | 'import'

/**
 * Validate and normalize history items.
 * - import: non-terminal → unknown + stale createdAt (avoid polling foreign tasks)
 * - local: keep recent pending; demote stale pending to unknown
 */
export function normalizeHistoryItems(
  items: unknown[],
  mode: NormalizeMode,
): HistoryItem[] {
  const now = Date.now()
  const unknownStaleAt = now - UNKNOWN_STALE_MS
  const pendingStaleAt = now - PENDING_STALE_MS

  const valid = items.flatMap((h): HistoryItem[] => {
    if (!h || typeof h !== 'object' || Array.isArray(h)) return []
    const item = h as Record<string, unknown>
    if (typeof item.taskId !== 'string' || typeof item.model !== 'string') {
      return []
    }
    if (item.category !== 'image' && item.category !== 'video') return []

    const isTerminal = item.state === 'success' || item.state === 'fail'
    const rawCreatedAt = asFiniteNumber(item.createdAt) ?? now
    const parsedCreatedAt = normalizeTimestamp(rawCreatedAt, now)

    let state: TaskState
    let createdAt: number

    if (isTerminal) {
      state = item.state as 'success' | 'fail'
      createdAt = parsedCreatedAt
    } else if (mode === 'import') {
      // 別環境のタスクをポーリングしない
      state = 'unknown'
      createdAt = Math.min(parsedCreatedAt, unknownStaleAt)
    } else if (
      item.state === 'waiting' ||
      item.state === 'queuing' ||
      item.state === 'generating'
    ) {
      if (parsedCreatedAt < pendingStaleAt) {
        state = 'unknown'
        createdAt = Math.min(parsedCreatedAt, unknownStaleAt)
      } else {
        state = item.state
        createdAt = parsedCreatedAt
      }
    } else {
      state = 'unknown'
      createdAt = parsedCreatedAt
    }

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

  return capItems(valid.sort((a, b) => b.createdAt - a.createdAt))
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
  const valid = normalizeHistoryItems(items, 'import')
  if (valid.length === 0) {
    throw new Error('インポートできる履歴がありませんでした')
  }
  return valid
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
