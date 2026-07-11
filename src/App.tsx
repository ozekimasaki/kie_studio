import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { CategoryTabs } from './components/CategoryTabs.tsx'
import { ModelSelect } from './components/ModelSelect.tsx'
import {
  DynamicForm,
  buildDefaultValues,
  validateFields,
} from './components/DynamicForm.tsx'
import { CreditBadge } from './components/CreditBadge.tsx'
import { HistoryGallery } from './components/HistoryGallery.tsx'
import { StudioShell } from './components/shell/StudioShell.tsx'
import { Pressable } from './components/motion/Pressable.tsx'
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
  normalizeTimestamp,
  parseHistoryJson,
  PENDING_STALE_MS,
  removeFromList,
  saveHistory,
  saveHistoryDebounced,
  togglePinInList,
  UNKNOWN_STALE_MS,
  upsertInList,
} from './lib/history.ts'
import { isVideoUrl } from './lib/media.ts'
import type {
  FieldSchema,
  HistoryItem,
  ModelCategory,
  ModelDefinition,
} from './lib/models/types.ts'

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
    const raw = input[field.name]
    if (raw === undefined) continue
    // History may store scalar reference as a bare string URL.
    if (
      field.type === 'reference' &&
      field.scalar &&
      typeof raw === 'string'
    ) {
      values[field.name] = raw ? [raw] : []
      continue
    }
    values[field.name] = raw
  }
  return values
}

type GenerateVars =
  | { source: 'form' }
  | { source: 'retry'; item: HistoryItem }

function isPendingState(item: HistoryItem): boolean {
  const age = Date.now() - item.createdAt
  if (
    item.state === 'waiting' ||
    item.state === 'queuing' ||
    item.state === 'generating'
  ) {
    return age < PENDING_STALE_MS
  }
  if (item.state === 'unknown') {
    return age < UNKNOWN_STALE_MS
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
    staleTime: 5 * 60_000,
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

  // 開いたまま期限切れになった進行中を unknown に落とす
  useEffect(() => {
    const demoteStalePending = () => {
      setHistory((prev) => {
        const now = Date.now()
        let changed = false
        const next = prev.map((h) => {
          if (
            (h.state === 'waiting' ||
              h.state === 'queuing' ||
              h.state === 'generating') &&
            now - h.createdAt >= PENDING_STALE_MS
          ) {
            changed = true
            return { ...h, state: 'unknown' as const }
          }
          return h
        })
        return changed ? saveHistory(next) : prev
      })
    }
    demoteStalePending()
    const id = window.setInterval(demoteStalePending, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const taskQueries = useQueries({
    queries: pendingTaskIds.map((taskId) => ({
      queryKey: ['task', taskId] as const,
      queryFn: () => fetchTask(taskId),
      refetchInterval: 2500,
      refetchIntervalInBackground: false,
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
          createdAt: normalizeTimestamp(data.createTime, existing.createdAt),
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
      return saveHistoryDebounced(next)
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
        if (
          field.type === 'reference' &&
          field.scalar &&
          Array.isArray(v)
        ) {
          const first = v.find((u) => typeof u === 'string' && u.length > 0)
          if (typeof first !== 'string') continue
          input[field.name] = first
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
        return saveHistory(next)
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
          h.state === 'success' &&
          h.model === selected.model &&
          typeof h.creditsConsumed === 'number',
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
    const target = refFields.find((f) =>
      f.accept
        ? isVideo
          ? /video/i.test(f.accept)
          : /image/i.test(f.accept)
        : true,
    )
    if (!target) {
      setFormError(
        isVideo
          ? '現在のモデルは動画入力に対応していません。対応モデルに切り替えてから使ってください'
          : '現在のモデルは画像入力に対応していません。対応モデルに切り替えてから使ってください',
      )
      return
    }
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
    let rejected: 'pin-limit' | undefined
    setHistory((prev) => {
      const result = togglePinInList(prev, taskId)
      rejected = result.rejected
      if (result.rejected) return prev
      return saveHistory(result.next)
    })
    if (rejected === 'pin-limit') {
      setFormError('ピン留めは最大30件までです')
    }
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
    try {
      const items = parseHistoryJson(raw)
      setHistory((prev) => saveHistory(mergeHistory(prev, items)))
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
    <StudioShell
      chromeTitle={
        <>
          KIE <span className="text-[var(--accent)]">STUDIO</span>
        </>
      }
      chromeSubtitle="kie.ai Market API · IMAGE / VIDEO"
      chromeMeta={
        <>
          {syncedAt && (
            <p className="studio-meta">
              catalog {new Date(syncedAt).toLocaleString()}
            </p>
          )}
          {!syncedAt && modelsQuery.data?.data.source === 'seed' && (
            <p className="studio-meta text-[var(--warning)]">
              seed catalog · run npm run sync:models
            </p>
          )}
        </>
      }
      chromeTrailing={<CreditBadge lastUsed={lastUsedCredits} />}
      form={
        <>
          <div className="sticky top-0 z-[var(--z-sticky)] -mx-5 -mt-5 shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 pt-5 pb-3">
            <CategoryTabs
              value={category}
              onChange={(c) => {
                pendingRestoreRef.current = null
                setCategory(c)
                setModelId(null)
              }}
            />
          </div>

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
                  className="inline-flex items-center gap-1 self-start text-xs font-medium text-[var(--accent)]"
                >
                  Docs
                  <ExternalLink size={12} strokeWidth={2} aria-hidden />
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

              <div className="studio-sticky-cta space-y-2">
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
                      <Pressable
                        key={n}
                        disabled={submitting}
                        aria-pressed={batchCount === n}
                        onClick={() => setBatchCount(n)}
                        className={`studio-chip ${
                          batchCount === n ? 'is-active' : ''
                        }`}
                        scaleTo={0.96}
                      >
                        ×{n}
                      </Pressable>
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
                <Pressable
                  disabled={generateDisabled}
                  onClick={() => generate.mutate({ source: 'form' })}
                  className="studio-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  scaleTo={0.96}
                >
                  {submitting
                    ? '送信中…'
                    : batchCount > 1
                      ? `Generate ×${batchCount}`
                      : 'Generate'}
                </Pressable>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              モデルを選択してください
            </p>
          )}
        </>
      }
      canvas={
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
            setHistory((prev) => saveHistory(removeFromList(prev, taskId)))
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
            setHistory((prev) => saveHistory(prev.filter((h) => h.pinned)))
            setViewerTaskId(null)
          }}
        />
      }
    />
  )
}
