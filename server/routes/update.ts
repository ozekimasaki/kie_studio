import { Hono } from 'hono'

export interface UpdateCheckResult {
  available: boolean
  version?: string
  downloaded?: boolean
}

type UpdateHandler = () => Promise<UpdateCheckResult>

let handler: UpdateHandler | null = null

/**
 * デスクトップメインプロセス（src/bun/index.ts）から Updater ハンドラを登録する。
 * 未登録時（dev / web 環境）は 503 を返す。
 */
export function registerUpdateHandler(fn: UpdateHandler) {
  handler = fn
}

export const updateRoutes = new Hono()

updateRoutes.post('/update/check', async (c) => {
  if (!handler) {
    return c.json(
      { error: 'アップデート機能はデスクトップ版でのみ利用できます' },
      503,
    )
  }
  try {
    const result = await handler()
    return c.json({ data: result })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'アップデート確認に失敗しました'
    return c.json({ error: message }, 500)
  }
})
