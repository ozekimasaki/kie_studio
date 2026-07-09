import { useEffect, useMemo, useState } from 'react'
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { CategoryTabs } from './components/CategoryTabs.tsx'
import { ModelSelect } from './components/ModelSelect.tsx'
import { DynamicForm, buildDefaultValues } from './components/DynamicForm.tsx'
import { CreditBadge } from './components/CreditBadge.tsx'
import { HistoryGallery } from './components/HistoryGallery.tsx'
import { fetchModels, fetchTask, generateTask } from './lib/api.ts'
import {
  clearHistory,
  loadHistory,
  removeHistory,
  saveHistory,
  upsertHistory,
} from './lib/history.ts'
import type {
  HistoryItem,
  ModelCategory,
  ModelDefinition,
  TaskState,
} from './lib/models/types.ts'

function promptFromInput(input: Record<string, unknown>): string | undefined {
  const p = input.prompt
  return typeof p === 'string' ? p.slice(0, 120) : undefined
}

function isPendingState(state: TaskState): boolean {
  return (
    state === 'waiting' ||
    state === 'queuing' ||
    state === 'generating' ||
    state === 'unknown'
  )
}

export default function App() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<ModelCategory>('image')
  const [modelId, setModelId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [viewerTaskId, setViewerTaskId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [lastUsedCredits, setLastUsedCredits] = useState<number | null>(null)

  const modelsQuery = useQuery({
    queryKey: ['models', category],
    queryFn: () => fetchModels(category),
  })

  const models = modelsQuery.data?.data.models ?? []
  const syncedAt = modelsQuery.data?.data.syncedAt

  const selected: ModelDefinition | undefined = useMemo(
    () => models.find((m) => m.id === modelId) ?? models[0],
    [models, modelId],
  )

  useEffect(() => {
    if (!selected) return
    setModelId(selected.id)
    setValues(buildDefaultValues(selected.fields))
    setFormError(null)
  }, [selected?.id])

  const pendingTaskIds = useMemo(
    () => history.filter((h) => isPendingState(h.state)).map((h) => h.taskId),
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
          existing.creditsConsumed === data.creditsConsumed
        ) {
          continue
        }

        const item: HistoryItem = {
          ...existing,
          state: data.state,
          resultUrls: data.resultUrls,
          creditsConsumed: data.creditsConsumed,
          createdAt: data.createTime ?? existing.createdAt,
        }
        next = [item, ...next.filter((h) => h.taskId !== item.taskId)]
        changed = true

        if (data.state === 'success' && typeof data.creditsConsumed === 'number') {
          latestUsed = data.creditsConsumed
          creditsChanged = true
        }
      }

      if (!changed) return prev
      saveHistory(next)
      return next
    })

    if (latestUsed !== null) setLastUsedCredits(latestUsed)
    if (creditsChanged) {
      void queryClient.invalidateQueries({ queryKey: ['credits'] })
    }
    // taskSnapshots drives this effect; taskQueries is read for latest data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskSnapshots, queryClient])

  const generate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('No model selected')
      setFormError(null)

      for (const field of selected.fields) {
        if (!field.required) continue
        const v = values[field.name]
        if (v === undefined || v === null || v === '') {
          throw new Error(`${field.label} is required`)
        }
        if (field.type === 'reference' && Array.isArray(v) && v.length === 0) {
          throw new Error(`${field.label} is required`)
        }
      }

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
              Array.isArray((el as { element_input_urls?: string[] }).element_input_urls) &&
              ((el as { element_input_urls: string[] }).element_input_urls?.length ?? 0) >= 1,
          )
          if (cleaned.length === 0) continue
          input[field.name] = cleaned
          continue
        }
        input[field.name] = v
      }

      const model = selected
      const res = await generateTask({ model: model.model, input })
      return {
        taskId: res.data.taskId,
        input,
        model,
      }
    },
    onSuccess: ({ taskId, input, model }) => {
      setHistory(
        upsertHistory({
          taskId,
          model: model.model,
          category: model.category,
          state: 'waiting',
          createdAt: Date.now(),
          prompt: promptFromInput(input),
        }),
      )
    },
    onError: (e) => {
      setFormError(e instanceof Error ? e.message : 'Generate failed')
    },
  })

  const submitting = generate.isPending

  function selectHistory(h: HistoryItem) {
    setViewerTaskId(h.taskId)
  }

  function closeViewer() {
    setViewerTaskId(null)
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
              setCategory(c)
              setModelId(null)
            }}
          />

          {modelsQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading models…</p>
          ) : modelsQuery.isError ? (
            <p className="text-sm text-[var(--danger)]">
              {(modelsQuery.error as Error).message}
            </p>
          ) : (
            <ModelSelect
              models={models}
              value={selected?.id ?? null}
              onChange={(id) => setModelId(id)}
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
                onChange={(name, value) =>
                  setValues((prev) => ({ ...prev, [name]: value }))
                }
              />

              {formError && (
                <p className="text-sm text-[var(--danger)]">{formError}</p>
              )}
              {generate.isError && !formError && (
                <p className="text-sm text-[var(--danger)]">
                  {(generate.error as Error).message}
                </p>
              )}

              {pendingCount > 0 && (
                <p className="text-xs text-[var(--warning)]">
                  ギャラリーで {pendingCount} 件を並列生成中…
                </p>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={() => generate.mutate()}
                className="sticky bottom-0 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? '送信中…' : 'Generate'}
              </button>
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
            onRemove={(taskId) => {
              const next = removeHistory(taskId)
              setHistory(next)
              if (viewerTaskId === taskId) setViewerTaskId(null)
            }}
            onClear={() => {
              setHistory(clearHistory())
              setViewerTaskId(null)
            }}
          />
        </main>
      </div>
    </div>
  )
}
