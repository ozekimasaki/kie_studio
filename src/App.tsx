import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { CategoryTabs } from './components/CategoryTabs.tsx'
import { ModelSelect } from './components/ModelSelect.tsx'
import {
  DynamicForm,
  buildDefaultValues,
  validateFields,
} from './components/DynamicForm.tsx'
import { CreditBadge } from './components/CreditBadge.tsx'
import { HistoryGallery } from './components/HistoryGallery.tsx'
import {
  fetchHealth,
  fetchModels,
  fetchTask,
  generateTask,
} from './lib/api.ts'
import {
  exportHistoryJson,
  loadHistory,
  mergeHistory,
  parseHistoryJson,
  removeFromList,
  saveHistory,
  togglePinInList,
  upsertInList,
} from './lib/history.ts'
import { isVideoUrl } from './lib/media.ts'
import type {
  FieldSchema,
  HistoryItem,
  ModelCategory,
  ModelDefinition,
} from './lib/models/types.ts'

const UNKNOWN_STALE_MS = 10 * 60 * 1000

function promptFromInput(input: Record<string, unknown>): string | undefined {
  const p = input.prompt
  return typeof p === 'string' ? p.slice(0, 120) : undefined
}

/** Restore saved input over defaults; unknown keys are dropped. */
function mergeInputWithDefaults(
  fields: FieldSchema[],
  input: Record<string, unknown>,
): Record<string, unknown> {
  const values = buildDefaultValues(fields)
  for (const field of fields) {
    if (input[field.name] !== undefined) {
      values[field.name] = input[field.name]
    }
  }
  return values
}

type GenerateVars =
  | { source: 'form' }
  | { source: 'retry'; item: HistoryItem }

function isPendingState(item: HistoryItem): boolean {
  if (
    item.state === 'waiting' ||
    item.state === 'queuing' ||
    item.state === 'generating'
  ) {
    return true
  }
  if (item.state === 'unknown') {
    return Date.now() - item.createdAt < UNKNOWN_STALE_MS
  }
  return false
}

export default function App() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<ModelCategory>('image')
  const [modelId, setModelId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [viewerTaskId, setViewerTaskId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [lastUsedCredits, setLastUsedCredits] = useState<number | null>(null)
  const [batchCount, setBatchCount] = useState(1)
  const pendingRestoreRef = useRef<{
    modelId: string
    input: Record<string, unknown>
  } | null>(null)

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
  })

  const modelsQuery = useQuery({
    queryKey: ['models', category],
    queryFn: () => fetchModels(category),
  })

  const models = modelsQuery.data?.data.models ?? []
  const syncedAt = modelsQuery.data?.data.syncedAt
  const hasApiKey = healthQuery.data?.hasKey === true

  const selected: ModelDefinition | undefined = useMemo(
    () => models.find((m) => m.id === modelId) ?? models[0],
    [models, modelId],
  )

  useEffect(() => {
    if (!selected) return
    setModelId(selected.id)
    const pending = pendingRestoreRef.current
    if (pending && pending.modelId === selected.id) {
      // 履歴からの復元: デフォルト値の上に保存済み入力を重ねる
      pendingRestoreRef.current = null
      setValues(mergeInputWithDefaults(selected.fields, pending.input))
      setFormError(null)
    } else if (pending && models.length > 0) {
      // 復元先モデルがカタログから消えている
      pendingRestoreRef.current = null
      setValues(buildDefaultValues(selected.fields))
      setFormError(
        '復元しようとしたモデルが現在のカタログに見つかりませんでした',
      )
    } else {
      setValues(buildDefaultValues(selected.fields))
      setFormError(null)
    }
    setFieldErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const pendingTaskIds = useMemo(
    () => history.filter((h) => isPendingState(h)).map((h) => h.taskId),
    [history],
  )

  const pendingCount = pendingTaskIds.length

  const taskQueries = useQueries({
    queries: pendingTaskIds.map((taskId) => ({
      queryKey: ['task', taskId] as const,
      queryFn: () => fetchTask(taskId),
      refetchInterval: 2500,
      retry: 2,
    })),
  })

  const taskSnapshots = taskQueries
    .map((q) => q.data?.data)
    .filter(Boolean)
    .map((d) =>
      [
        d!.taskId,
        d!.state,
        d!.resultUrls?.join(',') ?? '',
        d!.creditsConsumed ?? '',
        d!.failMsg ?? '',
      ].join('|'),
    )
    .join(';')

  useEffect(() => {
    const updates = taskQueries
      .map((q) => q.data?.data)
      .filter((d): d is NonNullable<typeof d> => Boolean(d))

    if (updates.length === 0) return

    let creditsChanged = false
    let latestUsed: number | null = null
    let autoOpenTaskId: string | null = null

    setHistory((prev) => {
      let next = prev
      let changed = false

      for (const data of updates) {
        const existing = next.find((h) => h.taskId === data.taskId)
        if (!existing) continue
        if (
          existing.state === data.state &&
          (existing.resultUrls?.join(',') ?? '') ===
            (data.resultUrls?.join(',') ?? '') &&
          existing.creditsConsumed === data.creditsConsumed &&
          (existing.failMsg ?? '') === (data.failMsg ?? '')
        ) {
          continue
        }

        const item: HistoryItem = {
          ...existing,
          state: data.state,
          resultUrls: data.resultUrls,
          creditsConsumed: data.creditsConsumed,
          failMsg: data.failMsg,
          createdAt: data.createTime ?? existing.createdAt,
        }
        next = upsertInList(next, item)
        changed = true

        if (
          data.state === 'success' &&
          existing.state !== 'success' &&
          (data.resultUrls?.length ?? 0) > 0
        ) {
          autoOpenTaskId = data.taskId
        }

        if (data.state === 'success' && typeof data.creditsConsumed === 'number') {
          latestUsed = data.creditsConsumed
          creditsChanged = true
        }
      }

      if (!changed) return prev
      saveHistory(next)
      return next
    })

    if (autoOpenTaskId) setViewerTaskId(autoOpenTaskId)
    if (latestUsed !== null) setLastUsedCredits(latestUsed)
    if (creditsChanged) {
      void queryClient.invalidateQueries({ queryKey: ['credits'] })
    }
    // taskSnapshots drives this effect; taskQueries is read for latest data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSnapshots, queryClient])

  const generate = useMutation({
    mutationFn: async (vars: GenerateVars) => {
      if (!hasApiKey) {
        throw new Error('API キーが未設定です。.env に KIE_API_KEY を設定してください')
      }
      setFormError(null)

      // 失敗履歴からのリトライ: 保存済み入力をそのまま再送信
      if (vars.source === 'retry') {
        const { item } = vars
        if (!item.input) {
          throw new Error('この履歴には入力データが保存されていません')
        }
        const res = await generateTask({ model: item.model, input: item.input })
        return {
          taskIds: [res.data.taskId],
          input: item.input,
          model: item.model,
          category: item.category,
          modelId: item.modelId,
          failedCount: 0,
        }
      }

      if (!selected) throw new Error('モデルが選択されていません')

      const errors = validateFields(selected.fields, values)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        throw new Error('入力内容を確認してください')
      }
      setFieldErrors({})

      const input: Record<string, unknown> = {}
      for (const field of selected.fields) {
        const v = values[field.name]
        if (v === undefined || v === '') continue
        if (field.type === 'reference' && Array.isArray(v) && v.length === 0) {
          continue
        }
        if (field.type === 'kling_elements' && Array.isArray(v)) {
          const cleaned = v.filter(
            (el) =>
              el &&
              typeof el === 'object' &&
              typeof (el as { name?: string }).name === 'string' &&
              (el as { name: string }).name.trim() &&
              Array.isArray(
                (el as { element_input_urls?: string[] }).element_input_urls,
              ) &&
              ((el as { element_input_urls: string[] }).element_input_urls
                ?.length ?? 0) >= 1,
          )
          if (cleaned.length === 0) continue
          input[field.name] = cleaned
          continue
        }
        input[field.name] = v
      }

      const model = selected
      const count = Math.max(1, Math.min(4, batchCount))
      const settled = await Promise.allSettled(
        Array.from({ length: count }, () =>
          generateTask({ model: model.model, input }),
        ),
      )
      const taskIds = settled
        .filter(
          (r): r is PromiseFulfilledResult<{ data: { taskId: string } }> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value.data.taskId)
      if (taskIds.length === 0) {
        const first = settled[0] as PromiseRejectedResult
        throw first.reason instanceof Error
          ? first.reason
          : new Error('生成リクエストに失敗しました')
      }
      return {
        taskIds,
        input,
        model: model.model,
        category: model.category,
        modelId: model.id,
        failedCount: count - taskIds.length,
      }
    },
    onSuccess: ({ taskIds, input, model, category, modelId, failedCount }) => {
      const now = Date.now()
      setHistory((prev) => {
        let next = prev
        for (const taskId of taskIds) {
          const item: HistoryItem = {
            taskId,
            model,
            category,
            state: 'waiting',
            createdAt: now,
            prompt: promptFromInput(input),
            modelId,
            input,
          }
          next = upsertInList(next, item)
        }
        saveHistory(next)
        return next
      })
      if (taskIds.length === 1) setViewerTaskId(taskIds[0])
      if (failedCount > 0) {
        setFormError(
          `${taskIds.length} 件を送信しました（${failedCount} 件は送信に失敗）`,
        )
      }
    },
    onError: (e) => {
      setFormError(e instanceof Error ? e.message : '生成に失敗しました')
    },
  })

  const submitting = generate.isPending
  const generateDisabled = submitting || !hasApiKey || healthQuery.isLoading

  // 同モデルの直近成功実績からクレジット消費を推定
  const creditEstimate = useMemo(() => {
    if (!selected) return null
    const samples = history
      .filter(
        (h) =>
          h.model === selected.model && typeof h.creditsConsumed === 'number',
      )
      .slice(0, 5)
      .map((h) => h.creditsConsumed as number)
    if (samples.length === 0) return null
    return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
  }, [history, selected])

  function selectHistory(h: HistoryItem) {
    setViewerTaskId(h.taskId)
  }

  function reuseHistory(h: HistoryItem) {
    if (!h.input || !h.modelId) return
    setViewerTaskId(null)
    if (selected && selected.id === h.modelId && category === h.category) {
      setValues(mergeInputWithDefaults(selected.fields, h.input))
      setFormError(null)
      setFieldErrors({})
      return
    }
    // 同カテゴリならカタログの有無を即時判定できる。存在しないモデルへの
    // 復元は selected.id が変化せず effect が発火しないケースがあるため、
    // ここで弾いて pendingRestoreRef を残留させない。
    if (category === h.category && !models.some((m) => m.id === h.modelId)) {
      setFormError(
        'この履歴のモデルは現在のカタログに見つかりませんでした',
      )
      return
    }
    pendingRestoreRef.current = { modelId: h.modelId, input: h.input }
    if (category !== h.category) setCategory(h.category)
    setModelId(h.modelId)
  }

  function retryHistory(h: HistoryItem) {
    setViewerTaskId(null)
    generate.mutate({ source: 'retry', item: h })
  }

  function sendToInput(url: string) {
    if (!selected) return
    setViewerTaskId(null)
    const refFields = selected.fields.filter((f) => f.type === 'reference')
    if (refFields.length === 0) {
      setFormError(
        '現在のモデルには画像/動画の入力フィールドがありません。Image to Image 系のモデルに切り替えてから使ってください',
      )
      return
    }
    const isVideo = isVideoUrl(url)
    const target =
      refFields.find((f) =>
        f.accept
          ? isVideo
            ? /video/i.test(f.accept)
            : /image/i.test(f.accept)
          : true,
      ) ?? refFields[0]
    const current = Array.isArray(values[target.name])
      ? (values[target.name] as string[])
      : []
    if (current.includes(url)) return
    const max = target.maxItems ?? 8
    if (current.length >= max) {
      setFormError(`${target.label} は最大 ${max} 件までです`)
      return
    }
    handleFieldChange(target.name, [...current, url])
    setFormError(null)
  }

  function togglePin(taskId: string) {
    setHistory((prev) => {
      const next = togglePinInList(prev, taskId)
      saveHistory(next)
      return next
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
    URL.revokeObjectURL(url)
  }

  function importHistory(raw: string) {
    try {
      const items = parseHistoryJson(raw)
      setHistory((prev) => {
        const next = mergeHistory(prev, items)
        saveHistory(next)
        return next
      })
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : '履歴のインポートに失敗しました',
      )
    }
  }

  function closeViewer() {
    setViewerTaskId(null)
  }

  function handleFieldChange(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            KIE <span className="text-[var(--accent)]">STUDIO</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            IMAGE / VIDEO playground for kie.ai Market API
            {syncedAt && (
              <span className="ml-2 text-[11px]">
                catalog {new Date(syncedAt).toLocaleString()}
              </span>
            )}
            {!syncedAt && modelsQuery.data?.data.source === 'seed' && (
              <span className="ml-2 text-[11px] text-[var(--warning)]">
                seed catalog · run npm run sync:models
              </span>
            )}
          </p>
        </div>
        <CreditBadge lastUsed={lastUsedCredits} />
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_1fr]">
        <aside className="flex max-h-[calc(100vh-8rem)] flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <CategoryTabs
            value={category}
            onChange={(c) => {
              // ユーザー操作での切替は保留中の履歴復元を破棄する
              pendingRestoreRef.current = null
              setCategory(c)
              setModelId(null)
            }}
          />

          {modelsQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">モデル読込中…</p>
          ) : modelsQuery.isError ? (
            <p className="text-sm text-[var(--danger)]">
              {(modelsQuery.error as Error).message}
            </p>
          ) : (
            <ModelSelect
              models={models}
              value={selected?.id ?? null}
              onChange={(id) => {
                pendingRestoreRef.current = null
                setModelId(id)
              }}
              disabled={submitting}
            />
          )}

          {selected ? (
            <>
              {selected.docsUrl && (
                <a
                  href={selected.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start text-xs text-[var(--accent)] hover:underline"
                >
                  Docs ↗
                </a>
              )}

              <DynamicForm
                fields={selected.fields}
                values={values}
                onChange={handleFieldChange}
                disabled={submitting}
                fieldErrors={fieldErrors}
                modelId={selected.id}
              />

              {formError && (
                <p className="text-sm text-[var(--danger)]">{formError}</p>
              )}

              {!hasApiKey && !healthQuery.isLoading && (
                <p className="text-sm text-[var(--warning)]">
                  API キー未設定のため生成できません。.env に KIE_API_KEY
                  を設定してください。
                </p>
              )}

              {pendingCount > 0 && (
                <p className="text-xs text-[var(--warning)]">
                  ギャラリーで {pendingCount} 件を並列生成中…
                </p>
              )}

              <div className="sticky bottom-0 space-y-2 bg-[var(--bg-panel)] pt-1">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label="同時生成数"
                  >
                    <span className="mr-1 text-[11px] text-[var(--text-muted)]">
                      同時生成
                    </span>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={submitting}
                        aria-pressed={batchCount === n}
                        onClick={() => setBatchCount(n)}
                        className={`rounded-md px-2 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                          batchCount === n
                            ? 'bg-[var(--accent)] text-white'
                            : 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        ×{n}
                      </button>
                    ))}
                  </div>
                  {creditEstimate !== null && (
                    <span
                      className="text-[11px] text-[var(--text-muted)]"
                      title="このモデルの直近成功実績からの推定"
                    >
                      実績 約{creditEstimate} cr/回
                      {batchCount > 1 && ` · 計 約${creditEstimate * batchCount}`}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={generateDisabled}
                  onClick={() => generate.mutate({ source: 'form' })}
                  className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? '送信中…'
                    : batchCount > 1
                      ? `Generate ×${batchCount}`
                      : 'Generate'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              モデルを選択してください
            </p>
          )}
        </aside>

        <main className="max-h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4">
          <HistoryGallery
            items={history}
            activeTaskId={viewerTaskId}
            pendingCount={pendingCount}
            onSelect={selectHistory}
            onClose={closeViewer}
            onReuse={reuseHistory}
            onRetry={retryHistory}
            onSendToInput={sendToInput}
            onTogglePin={togglePin}
            onExport={exportHistory}
            onImport={importHistory}
            retryDisabled={generateDisabled}
            onRemove={(taskId) => {
              setHistory((prev) => {
                const next = removeFromList(prev, taskId)
                saveHistory(next)
                return next
              })
              if (viewerTaskId === taskId) setViewerTaskId(null)
            }}
            onClear={() => {
              if (
                !window.confirm(
                  'ピン留め以外の履歴をすべて削除しますか？この操作は取り消せません。',
                )
              ) {
                return
              }
              setHistory((prev) => {
                const next = prev.filter((h) => h.pinned)
                saveHistory(next)
                return next
              })
              setViewerTaskId(null)
            }}
          />
        </main>
      </div>
    </div>
  )
}
