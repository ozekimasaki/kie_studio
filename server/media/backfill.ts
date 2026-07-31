import { Hono } from 'hono'
import { archiveTaskMedia } from './archiver.ts'
import { listUnarchivedMedia, updateMediaLocalPaths } from '../db/history.ts'

const MAX_CONCURRENCY = 2

let backfillRunning = false

/**
 * Process unarchived media items with limited concurrency.
 * Downloads media files for existing history items that lack localPath.
 * Items older than 14 days will fail (kie.ai deleted them) — skipped gracefully.
 */
async function runBackfill(): Promise<{ archived: number; failed: number }> {
  if (backfillRunning) return { archived: 0, failed: 0 }
  backfillRunning = true

  let archived = 0
  let failed = 0

  try {
    const items = listUnarchivedMedia(50)
    if (items.length === 0) {
      console.log('[media-backfill] no unarchived items')
      return { archived: 0, failed: 0 }
    }

    console.log(`[media-backfill] starting backfill for ${items.length} items`)

    // Process with limited concurrency
    const queue = [...items]
    const workers = Array.from({ length: MAX_CONCURRENCY }, async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item) break
        try {
          const result = await archiveTaskMedia(item.taskId, item.media)
          const hasNewLocal = result.some((asset) => asset.localPath)
          if (hasNewLocal) {
            updateMediaLocalPaths(item.taskId, result)
            archived++
          } else {
            failed++
          }
        } catch {
          failed++
        }
      }
    })

    await Promise.all(workers)
    console.log(`[media-backfill] done: ${archived} archived, ${failed} failed/skipped`)
  } finally {
    backfillRunning = false
  }

  return { archived, failed }
}

/** Call once at server startup (fire-and-forget). */
export function startBackfill(): void {
  void runBackfill().catch((err) =>
    console.error('[media-backfill] unexpected error', err),
  )
}

/** Manual trigger route: POST /api/media/backfill */
export const backfillRoutes = new Hono()

backfillRoutes.post('/media/backfill', (c) => {
  if (backfillRunning) {
    return c.json({ data: { status: 'already_running' } })
  }
  void runBackfill().catch((err) =>
    console.error('[media-backfill] manual trigger error', err),
  )
  return c.json({ data: { status: 'started' } })
})
