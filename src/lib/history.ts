import type { HistoryItem } from './models/types.ts'

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

export function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

/** Merge into an in-memory list (avoids localStorage race on rapid updates). */
export function upsertInList(
  prev: HistoryItem[],
  item: HistoryItem,
): HistoryItem[] {
  return [item, ...prev.filter((h) => h.taskId !== item.taskId)].slice(
    0,
    MAX_ITEMS,
  )
}

export function removeFromList(
  prev: HistoryItem[],
  taskId: string,
): HistoryItem[] {
  return prev.filter((h) => h.taskId !== taskId)
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
