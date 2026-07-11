import type { HistoryItem, TaskState } from './models/types.ts'

const KEY = 'kie-studio-history'
const MAX_ITEMS = 30

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
 * Keep all pinned items plus the newest MAX_ITEMS non-pinned items.
 * Pinned items don't consume the non-pinned budget, so a just-submitted
 * task is never evicted no matter how many items are pinned.
 */
function capItems(items: HistoryItem[]): HistoryItem[] {
  let nonPinnedBudget = MAX_ITEMS
  return items.filter((item) => {
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

export function togglePinInList(
  prev: HistoryItem[],
  taskId: string,
): HistoryItem[] {
  return prev.map((h) =>
    h.taskId === taskId ? { ...h, pinned: !h.pinned } : h,
  )
}

export function exportHistoryJson(items: HistoryItem[]): string {
  return JSON.stringify(
    { app: 'kie-studio', version: 1, exportedAt: new Date().toISOString(), items },
    null,
    2,
  )
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
  const valid = items.flatMap((h): HistoryItem[] => {
    if (!h || typeof h !== 'object') return []
    const item = h as Partial<HistoryItem>
    if (typeof item.taskId !== 'string' || typeof item.model !== 'string') {
      return []
    }
    if (item.category !== 'image' && item.category !== 'video') return []
    // 進行中状態は別環境のタスクを永久ポーリングしないよう unknown に落とす。
    // 不明な state 値も unknown 扱い（10分で staleness 判定される）。
    const state: TaskState =
      item.state === 'success' || item.state === 'fail'
        ? item.state
        : 'unknown'
    const createdAt =
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now()
    return [{ ...item, state, createdAt } as HistoryItem]
  })
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
