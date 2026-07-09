import type { HistoryItem } from './models/types.ts'

const KEY = 'kie-studio-history'

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
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 30)))
}

export function upsertHistory(item: HistoryItem): HistoryItem[] {
  const prev = loadHistory().filter((h) => h.taskId !== item.taskId)
  const next = [item, ...prev].slice(0, 30)
  saveHistory(next)
  return next
}

export function removeHistory(taskId: string): HistoryItem[] {
  const next = loadHistory().filter((h) => h.taskId !== taskId)
  saveHistory(next)
  return next
}

export function clearHistory(): HistoryItem[] {
  saveHistory([])
  return []
}
