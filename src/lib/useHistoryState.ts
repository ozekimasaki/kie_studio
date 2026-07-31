import {
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchHistory, importHistoryApi, putHistory } from './api.ts'
import {
  capItems,
  exportHistoryJson,
  MAX_PINNED,
  parseHistoryJson,
  PENDING_STALE_MS,
  removeFromList,
  togglePinInList,
  upsertInList,
} from './history.ts'
import { useHistoryPersistence } from './useHistoryPersistence.ts'
import { useHistoryMigration } from './useHistoryMigration.ts'
import type { HistoryItem } from './models/types.ts'

interface UseHistoryStateOptions {
  setFormError: Dispatch<SetStateAction<string | null>>
  setFormNotice: Dispatch<SetStateAction<string | null>>
}

/**
 * 履歴の state・サーバー永続化・localStorage 移行・ピン留め・
 * インポート/エクスポートをまとめて管理する。
 */
export function useHistoryState({
  setFormError,
  setFormNotice,
}: UseHistoryStateOptions) {
  const queryClient = useQueryClient()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const historyRef = useRef<HistoryItem[]>([])
  const [historyPersistReady, setHistoryPersistReady] = useState(false)

  const historyQuery = useQuery({
    queryKey: ['history'],
    queryFn: async () => (await fetchHistory()).data.items,
    staleTime: Infinity,
  })

  const handleHistoryStored = useCallback(
    (items: HistoryItem[]) => queryClient.setQueryData(['history'], items),
    [queryClient],
  )
  const handleHistoryRecovered = useCallback(
    (items: HistoryItem[]) => {
      setHistory(items)
      queryClient.setQueryData(['history'], items)
    },
    [queryClient],
  )
  const handleHistoryPersistError = useCallback(
    (error: unknown) => {
      setFormError(
        error instanceof Error ? error.message : '履歴の保存に失敗しました',
      )
    },
    [setFormError],
  )

  const requestHistoryPersist = useHistoryPersistence({
    items: history,
    ready: historyPersistReady,
    onStored: handleHistoryStored,
    onRecovered: handleHistoryRecovered,
    onError: handleHistoryPersistError,
  })

  useEffect(() => {
    historyRef.current = history
  }, [history])

  const handleHistoryMigrationError = useCallback(
    (error: unknown) => {
      setFormError(
        error instanceof Error
          ? `履歴の移行に失敗しました: ${error.message}`
          : '履歴の移行に失敗しました',
      )
    },
    [setFormError],
  )
  const handleHistoryReady = useCallback(() => {
    setHistoryPersistReady(true)
  }, [])

  useHistoryMigration({
    isSuccess: historyQuery.isSuccess,
    data: historyQuery.data,
    setHistory,
    queryClient,
    onReady: handleHistoryReady,
    onError: handleHistoryMigrationError,
  })

  // 開いたまま期限切れになった進行中を unknown に落とす
  useEffect(() => {
    const demoteStalePending = () => {
      const now = Date.now()
      let changed = false
      const next = historyRef.current.map((item) => {
        if (
          (item.state === 'waiting' ||
            item.state === 'queuing' ||
            item.state === 'generating') &&
          now - item.createdAt >= PENDING_STALE_MS
        ) {
          changed = true
          return { ...item, state: 'unknown' as const }
        }
        return item
      })
      if (!changed) return
      setHistory(next)
      requestHistoryPersist('immediate')
    }
    demoteStalePending()
    const id = window.setInterval(demoteStalePending, 60_000)
    return () => window.clearInterval(id)
  }, [requestHistoryPersist])

  // ピン留めの楽観的更新（即時 UI 反映、サーバー保存失敗時は自動ロールバック）
  const [optimisticHistory, applyOptimisticPin] = useOptimistic(
    history,
    (current: HistoryItem[], taskId: string) =>
      togglePinInList(current, taskId).next,
  )

  function togglePin(taskId: string) {
    const result = togglePinInList(history, taskId)
    if (result.rejected === 'pin-limit') {
      setFormError(`ピン留めは最大${MAX_PINNED}件までです`)
      return
    }
    startTransition(async () => {
      applyOptimisticPin(taskId)
      try {
        const response = await putHistory(capItems(result.next))
        setHistory(response.data.items)
        queryClient.setQueryData(['history'], response.data.items)
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : '履歴の保存に失敗しました',
        )
      }
    })
  }

  function exportHistory() {
    const blob = new Blob([exportHistoryJson(history)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kie-studio-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  function importHistory(raw: string) {
    void (async () => {
      try {
        const items = parseHistoryJson(raw)
        const res = await importHistoryApi(items)
        setHistory(res.data.items)
        queryClient.setQueryData(['history'], res.data.items)
        setFormNotice(`履歴をインポートしました（${res.data.items.length} 件）`)
      } catch (e) {
        setFormError(
          e instanceof Error ? e.message : '履歴のインポートに失敗しました',
        )
      }
    })()
  }

  function updateHistoryItem(item: HistoryItem) {
    setHistory((previous) => upsertInList(previous, item))
    requestHistoryPersist('immediate')
  }

  function removeHistoryItem(taskId: string) {
    setHistory((prev) => removeFromList(prev, taskId))
    requestHistoryPersist('immediate')
  }

  function clearUnpinned() {
    setHistory((prev) => prev.filter((h) => h.pinned))
    requestHistoryPersist('immediate')
  }

  return {
    history: optimisticHistory,
    setHistory,
    requestHistoryPersist,
    togglePin,
    exportHistory,
    importHistory,
    updateHistoryItem,
    removeHistoryItem,
    clearUnpinned,
  }
}
