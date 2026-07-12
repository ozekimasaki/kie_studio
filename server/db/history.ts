import type { HistoryItem } from '../../src/lib/models/types.ts'
import {
  capItems,
  mergeHistory,
  normalizeHistoryItems,
} from '../../src/lib/history.ts'
import { getDb } from './open.ts'

type HistoryRow = {
  task_id: string
  model: string
  category: string
  state: string
  created_at: number
  result_urls: string | null
  prompt: string | null
  credits_consumed: number | null
  fail_msg: string | null
  model_id: string | null
  input: string | null
  pinned: number
}

function parseJsonColumn<T>(raw: string | null): T | undefined {
  if (raw == null || raw === '') return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function rowToItem(row: HistoryRow): HistoryItem {
  const item: HistoryItem = {
    taskId: row.task_id,
    model: row.model,
    category: row.category as HistoryItem['category'],
    state: row.state as HistoryItem['state'],
    createdAt: row.created_at,
  }
  const resultUrls = parseJsonColumn<string[]>(row.result_urls)
  if (resultUrls?.length) item.resultUrls = resultUrls
  if (row.prompt != null) item.prompt = row.prompt
  if (row.credits_consumed != null) item.creditsConsumed = row.credits_consumed
  if (row.fail_msg != null) item.failMsg = row.fail_msg
  if (row.model_id != null) item.modelId = row.model_id
  const input = parseJsonColumn<Record<string, unknown>>(row.input)
  if (input) item.input = input
  if (row.pinned === 1) item.pinned = true
  return item
}

function insertStmt() {
  return getDb().prepare(`
    INSERT INTO history_items (
      task_id, model, category, state, created_at,
      result_urls, prompt, credits_consumed, fail_msg, model_id, input, pinned
    ) VALUES (
      @task_id, @model, @category, @state, @created_at,
      @result_urls, @prompt, @credits_consumed, @fail_msg, @model_id, @input, @pinned
    )
  `)
}

function itemToParams(item: HistoryItem) {
  return {
    task_id: item.taskId,
    model: item.model,
    category: item.category,
    state: item.state,
    created_at: item.createdAt,
    result_urls: item.resultUrls ? JSON.stringify(item.resultUrls) : null,
    prompt: item.prompt ?? null,
    credits_consumed: item.creditsConsumed ?? null,
    fail_msg: item.failMsg ?? null,
    model_id: item.modelId ?? null,
    input: item.input ? JSON.stringify(item.input) : null,
    pinned: item.pinned ? 1 : 0,
  }
}

/** Newest first. */
export function listHistory(): HistoryItem[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM history_items
       ORDER BY pinned DESC, created_at DESC`,
    )
    .all() as HistoryRow[]
  return rows.map(rowToItem)
}

export function historyCount(): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM history_items')
    .get() as { n: number }
  return row.n
}

/** Replace all rows with capped items. Returns the stored list. */
export function replaceAllHistory(items: HistoryItem[]): HistoryItem[] {
  const capped = capItems(
    [...items].sort((a, b) => b.createdAt - a.createdAt),
  )
  const db = getDb()
  const insert = insertStmt()
  const tx = db.transaction((list: HistoryItem[]) => {
    db.prepare('DELETE FROM history_items').run()
    for (const item of list) {
      insert.run(itemToParams(item))
    }
  })
  tx(capped)
  return listHistory()
}

/**
 * Accept unknown payload (e.g. PUT body), normalize as local studio data,
 * then replace.
 */
export function replaceAllFromUnknown(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('items must be an array')
  }
  const normalized = normalizeHistoryItems(raw, 'local')
  return replaceAllHistory(normalized)
}

/** Import merge: existing taskIds win. Atomic list → merge → replace. */
export function importHistoryItems(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('items must be an array')
  }
  const imported = normalizeHistoryItems(raw, 'import')
  const db = getDb()
  return db.transaction(() => {
    const current = listHistory()
    return replaceAllHistory(mergeHistory(current, imported))
  })()
}

/**
 * One-shot localStorage migration: normalize as local, then merge
 * (or fill empty DB). Existing DB taskIds win.
 * Atomic list → merge → replace so concurrent PUTs cannot be wiped.
 */
export function migrateHistoryItems(raw: unknown): HistoryItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('items must be an array')
  }
  const incoming = normalizeHistoryItems(raw, 'local')
  const db = getDb()
  return db.transaction(() => {
    const current = listHistory()
    if (current.length === 0) {
      return replaceAllHistory(incoming)
    }
    return replaceAllHistory(mergeHistory(current, incoming))
  })()
}
