import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { ExternalLink, Settings } from 'lucide-react'
import { CategoryTabs } from './components/CategoryTabs.tsx'
import { ModelSelect } from './components/ModelSelect.tsx'
import {
  buildDefaultValues,
  focusFirstFieldError,
  isFormDirty,
  validateFields,
} from './lib/form.ts'
import { DynamicForm } from './components/DynamicForm.tsx'
import { CreditBadge } from './components/CreditBadge.tsx'
import { HistoryGallery } from './components/HistoryGallery.tsx'
import {
  StudioShell,
  type MobileStudioView,
} from './components/shell/StudioShell.tsx'
import { Pressable } from './components/motion/Pressable.tsx'
import { AudioPlayerProvider } from './components/audio/AudioPlayer.tsx'
import { SunoStyleAssist } from './components/SunoStyleAssist.tsx'
import {
  ApiClientError,
  fetchAudioAssets,
  fetchHealth,
  fetchHistory,
  fetchModels,
  fetchPersonas,
  generateTask,
  importHistoryApi,
} from './lib/api.ts'
import { classifyApiError } from './lib/submissionQueue.ts'
import { useSubmissionQueue } from './lib/useSubmissionQueue.ts'
import {
  sanitizeWorkflowInput,
  validateWorkflowInput,
} from './lib/workflowValidation.ts'
import { parentTaskIdFor } from './lib/taskRelations.ts'
import {
  exportHistoryJson,
  MAX_PINNED,
  parseHistoryJson,
  PENDING_STALE_MS,
  removeFromList,
  togglePinInList,
  upsertInList,
} from './lib/history.ts'
import { isVideoUrl } from './lib/media.ts'
import { presentField } from './lib/studioPresentation.ts'
import { useHistoryPersistence } from './lib/useHistoryPersistence.ts'
import { useHistoryMigration } from './lib/useHistoryMigration.ts'
import { useTaskPolling } from './lib/useTaskPolling.ts'
import type {
  FieldSchema,
  HistoryItem,
  ModelCategory,
  ModelDefinition,
  MediaAsset,
  QuickAction,
} from './lib/models/types.ts'

const CreditPurchaseSheet = lazy(() =>
  import('./components/CreditPurchaseSheet.tsx').then((module) => ({
    default: module.CreditPurchaseSheet,
  })),
)

const SettingsSheet = lazy(() =>
  import('./components/SettingsSheet.tsx').then((module) => ({
    default: module.SettingsSheet,
  })),
)

function promptFromInput(input: Record<string, unknown>): string | undefined {
  const p = input.prompt ?? input.text
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

const EMPTY_MODELS: ModelDefinition[] = []

function isInsufficientCreditsError(error: unknown): boolean {
  if (error instanceof ApiClientError && error.status === 402) return true
  const message = error instanceof Error ? error.message : String(error)
  return /(?:insufficient|not enough|low)\s+(?:credit|balance)|(?:credit|balance).*?(?:insufficient|not enough|low)|クレジット.*(?:不足|足りない|切れ)|(?:不足|足りない).*(?:クレジット|credit)/i.test(
    message,
  )
}

export default function App() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState<ModelCategory>('image')
  const [modelId, setModelId] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [viewerTaskId, setViewerTaskId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formNotice, setFormNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [lastUsedCredits, setLastUsedCredits] = useState<number | null>(null)
  const [batchCount, setBatchCount] = useState(1)
  const [mobileView, setMobileView] = useState<MobileStudioView>('create')
  const [creditPurchaseSheetOpen, setCreditPurchaseSheetOpen] =
    useState(false)
  const [creditSheetRequested, setCreditSheetRequested] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [settingsSheetRequested, setSettingsSheetRequested] = useState(false)
  const pendingRestoreRef = useRef<{
    modelId: string
    input: Record<string, unknown>
  } | null>(null)
  const historyRef = useRef<HistoryItem[]>([])
  const [historyPersistReady, setHistoryPersistReady] = useState(false)
  const { queue: submissionQueue, items: submissionQueueItems } =
    useSubmissionQueue()

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
  })

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
  const handleHistoryPersistError = useCallback((error: unknown) => {
    setFormError(
      error instanceof Error ? error.message : '履歴の保存に失敗しました',
    )
  }, [])

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

  useEffect(() => {
    if (creditPurchaseSheetOpen) setCreditSheetRequested(true)
  }, [creditPurchaseSheetOpen])

  useEffect(() => {
    if (settingsSheetOpen) setSettingsSheetRequested(true)
  }, [settingsSheetOpen])

  const handleHistoryMigrationError = useCallback((error: unknown) => {
    setFormError(
      error instanceof Error
        ? `履歴の移行に失敗しました: ${error.message}`
        : '履歴の移行に失敗しました',
    )
  }, [])
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

  const modelsQuery = useQuery({
    queryKey: ['models', category],
    queryFn: () => fetchModels(category),
    staleTime: 5 * 60_000,
  })

  const models = modelsQuery.data?.data.models ?? EMPTY_MODELS
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
      setFormNotice('履歴の入力をフォームに復元しました')
    } else if (pending && models.length > 0) {
      // 復元先モデルがカタログから消えている
      pendingRestoreRef.current = null
      setValues(buildDefaultValues(selected.fields))
      setFormNotice(null)
      setFormError(
        '復元しようとしたモデルが現在のカタログに見つかりませんでした',
      )
    } else {
      setValues(buildDefaultValues(selected.fields))
      setFormError(null)
      setFormNotice(null)
    }
    setFieldErrors({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

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

  const handleCreditsUsed = useCallback(
    (credits: number) => {
      setLastUsedCredits(credits)
      void queryClient.invalidateQueries({ queryKey: ['credits'] })
    },
    [queryClient],
  )

  const { pendingCount, pendingTasks } = useTaskPolling({
    history,
    setHistory,
    requestHistoryPersist,
    onCreditsUsed: handleCreditsUsed,
  })

  const generate = useMutation({
    mutationFn: async (vars: GenerateVars) => {
      if (!hasApiKey) {
        throw new Error('API キーが未設定です。設定画面から KIE_API_KEY を保存してください')
      }
      setFormError(null)

      // 失敗履歴からのリトライ: 保存済み入力をそのまま再送信
      if (vars.source === 'retry') {
        const { item } = vars
        if (!item.input) {
          throw new Error('この履歴には入力データが保存されていません')
        }
        const provider = item.provider ?? 'market'
        const operation = item.operation ?? 'generate'
        const res = await submissionQueue.enqueue({
          provider,
          operation,
          model: item.model,
          run: () => generateTask({
            model: item.model,
            input: item.input as Record<string, unknown>,
            provider,
            operation,
          }),
        })
        return {
          tasks: [{ taskId: res.data.taskId, input: item.input, normalized: res.data.task }],
          model: item.model,
          category: item.category,
          modelId: item.modelId,
          provider,
          operation,
          parentTaskId: item.parentTaskId,
          failedCount: 0,
          insufficientCredits: false,
        }
      }

      if (!selected) throw new Error('モデルが選択されていません')

      const errors = {
        ...validateFields(selected.fields, values),
        ...validateWorkflowInput(selected, values),
      }
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
        focusFirstFieldError(errors)
        throw new Error('入力内容を確認してください')
      }
      setFieldErrors({})

      let input: Record<string, unknown> = {}
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

      input = sanitizeWorkflowInput(selected, input)

      const model = selected
      const parentTaskId = parentTaskIdFor(model.operation ?? 'generate', input)
      delete input._duration
      delete input._parentTaskId
      const count = Math.max(1, Math.min(4, batchCount))
      const segmentInputs = model.id === 'market/elevenlabs-tts' && typeof input.text === 'string'
        ? input.text
            .split(/\n\s*\n/g)
            .map((text) => text.trim())
            .filter(Boolean)
            .map((text, index, segments) => ({
              ...input,
              text,
              previous_text: segments[index - 1] ?? input.previous_text,
              next_text: segments[index + 1] ?? input.next_text,
            }))
        : [input]
      const requestInputs = Array.from(
        { length: count },
        () => segmentInputs,
      ).flat()
      const settled = await Promise.allSettled(
        requestInputs.map((requestInput) =>
          submissionQueue.enqueue({
            provider: model.provider,
            operation: model.operation ?? 'generate',
            model: model.model,
            run: () => generateTask({
              model: model.model,
              input: requestInput,
              provider: model.provider,
              operation: model.operation ?? 'generate',
            }),
          }),
        ),
      )
      const tasks = settled.flatMap((result, index) =>
        result.status === 'fulfilled'
          ? [{
              taskId: result.value.data.taskId,
              input: requestInputs[index] as Record<string, unknown>,
              normalized: result.value.data.task,
            }]
          : [],
      )
      const creditError = settled.find(
        (r): r is PromiseRejectedResult =>
          r.status === 'rejected' && isInsufficientCreditsError(r.reason),
      )
      if (tasks.length === 0) {
        const first = creditError ?? (settled[0] as PromiseRejectedResult)
        throw first.reason instanceof Error
          ? first.reason
          : new Error('生成リクエストに失敗しました')
      }
      return {
        tasks,
        model: model.model,
        category: model.category,
        modelId: model.id,
        provider: model.provider,
        operation: model.operation ?? 'generate',
        parentTaskId,
        failedCount: requestInputs.length - tasks.length,
        insufficientCredits: Boolean(creditError),
      }
    },
    onSuccess: ({
      tasks,
      model,
      category,
      modelId,
      provider,
      operation,
      parentTaskId,
      failedCount,
      insufficientCredits,
    }) => {
      setMobileView('history')
      const now = Date.now()
      setHistory((prev) => {
        let next = prev
        for (const task of tasks) {
          const item: HistoryItem = {
            taskId: task.taskId,
            model,
            category,
            state: task.normalized?.state ?? 'waiting',
            createdAt: now,
            prompt: promptFromInput(task.input),
            modelId,
            input: task.input,
            provider,
            operation,
            parentTaskId,
            resultUrls: task.normalized?.resultUrls,
            media: task.normalized?.media,
            providerStatus: task.normalized?.providerStatus,
            partial: task.normalized?.partial,
            expiresAt: task.normalized?.expiresAt,
            creditsConsumed: task.normalized?.creditsConsumed,
            failMsg: task.normalized?.failMsg,
            rawParam: task.normalized?.rawParam,
            rawResult: task.normalized?.rawResult,
          }
          next = upsertInList(next, item)
        }
        return next
      })
      requestHistoryPersist('immediate')
      if (tasks.length === 1) setViewerTaskId(tasks[0]?.taskId ?? null)
      if (failedCount > 0) {
        setFormError(
          `${tasks.length} 件を送信しました（${failedCount} 件は送信に失敗）${
            insufficientCredits ? '。クレジットが不足している可能性があります' : ''
          }`,
        )
        if (insufficientCredits) {
          setCreditPurchaseSheetOpen(true)
          void queryClient.invalidateQueries({ queryKey: ['credits'] })
        }
      }
    },
    onError: (e) => {
      const action = classifyApiError(e)
      const base = e instanceof Error ? e.message : '生成に失敗しました'
      setFormError(
        action === 'refunded'
          ? `${base}。クレジットは返却済みです。残高を更新しました`
          : action === 'fix-input'
            ? `${base}。入力内容を修正してから再送信してください`
            : base,
      )
      if (action === 'purchase' || isInsufficientCreditsError(e)) {
        setCreditPurchaseSheetOpen(true)
        void queryClient.invalidateQueries({ queryKey: ['credits'] })
      }
      if (action === 'refunded') {
        void queryClient.invalidateQueries({ queryKey: ['credits'] })
      }
    },
  })
  const personasQuery = useQuery({
    queryKey: ['personas'],
    queryFn: async () => (await fetchPersonas()).data.items,
    staleTime: 30_000,
  })
  const audioAssetsQuery = useQuery({
    queryKey: ['audio-assets'],
    queryFn: async () => (await fetchAudioAssets()).data.items,
    staleTime: 30_000,
  })

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['audio-assets'] })
    }
    window.addEventListener('kie:audio-assets-changed', refresh)
    return () => window.removeEventListener('kie:audio-assets-changed', refresh)
  }, [queryClient])

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

  const currentFormErrors = useMemo(() => {
    if (!selected) return {}
    return {
      ...validateFields(selected.fields, values),
      ...validateWorkflowInput(selected, values),
    }
  }, [selected, values])

  const formIssues = useMemo(() => {
    if (!selected) return []
    return Object.keys(currentFormErrors).map((name) => {
      const field = selected.fields.find((candidate) => candidate.name === name)
      return field ? presentField(field).label : name
    })
  }, [currentFormErrors, selected])

  function selectHistory(h: HistoryItem) {
    setViewerTaskId(h.taskId)
  }

  function reuseHistory(h: HistoryItem) {
    if (!h.input || !h.modelId) return
    setMobileView('create')
    setViewerTaskId(null)
    if (selected && selected.id === h.modelId && category === h.category) {
      setValues(mergeInputWithDefaults(selected.fields, h.input))
      setFormError(null)
      setFieldErrors({})
      setFormNotice('履歴の入力をフォームに復元しました')
      window.requestAnimationFrame(() => {
        document
          .getElementById('model-select')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
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
    setFormNotice('履歴の入力をフォームに復元しています…')
    if (category !== h.category) setCategory(h.category)
    setModelId(h.modelId)
  }

  function retryHistory(h: HistoryItem) {
    setViewerTaskId(null)
    generate.mutate({ source: 'retry', item: h })
  }

  function updateHistoryItem(item: HistoryItem) {
    setHistory((previous) => upsertInList(previous, item))
    requestHistoryPersist('immediate')
  }

  function openWorkflow(
    targetCategory: ModelCategory,
    targetModelId: string,
    input: Record<string, unknown>,
    notice: string,
  ) {
    setMobileView('create')
    setViewerTaskId(null)
    pendingRestoreRef.current = { modelId: targetModelId, input }
    setFormError(null)
    setFormNotice(notice)
    if (category !== targetCategory) setCategory(targetCategory)
    setModelId(targetModelId)
  }

  function quickAction(
    item: HistoryItem,
    media: MediaAsset,
    action: QuickAction,
    options: Record<string, unknown> = {},
  ) {
    const url = media.url ?? media.streamUrl
    const audioId = media.providerAssetId ?? media.id
    const metadata = media.metadata ?? {}
    switch (action) {
      case 'suno-extend':
        openWorkflow('audio', 'suno/extend', {
          taskId: item.taskId,
          audioId,
          continueAt: Math.max(0, (media.duration ?? 1) - 1),
          prompt: '',
          style: typeof metadata.tags === 'string' ? metadata.tags : '',
          title: media.title ?? '',
          model: typeof metadata.modelName === 'string' ? metadata.modelName : 'V5',
        }, '元の曲を引き継ぎました。内容を確認してから送信してください')
        break
      case 'suno-replace-section':
        openWorkflow('audio', 'suno/replace-section', {
          taskId: item.taskId,
          audioId,
          infillStartS: options.infillStartS ?? 0,
          infillEndS: options.infillEndS ?? Math.min(12, media.duration ?? 12),
          prompt: '',
          tags: typeof metadata.tags === 'string' ? metadata.tags : '',
          title: media.title ?? 'Edited section',
          _duration: media.duration ?? 0,
        }, '選択区間を引き継ぎました。置換内容を入力してから送信してください')
        break
      case 'suno-upload-extend':
        openWorkflow('audio', 'suno/upload-extend', {
          uploadUrl: url,
          continueAt: Math.max(0, (media.duration ?? 1) - 1),
          prompt: '',
        }, '音源を引き継ぎました。続きを確認してから送信してください')
        break
      case 'runway-aleph':
        openWorkflow('video', 'runway/aleph', { _parentTaskId: item.taskId, videoUrl: url, prompt: '' }, '元動画を引き継ぎました。変更内容を入力してから送信してください')
        break
      case 'runway-extend':
        openWorkflow('video', 'runway/extend', {
          taskId: item.taskId,
          videoId: media.providerAssetId ?? '',
          prompt: '',
        }, '元動画を引き継ぎました。延長内容を確認してから送信してください')
        break
      case 'veo-extend':
        openWorkflow('video', 'veo/extend', { taskId: item.taskId, prompt: '' }, '元動画を引き継ぎました。延長内容を確認してから送信してください')
        break
      case 'veo-1080p':
        openWorkflow('video', 'veo/1080p', { taskId: item.taskId, index: 0 }, '元タスクを引き継ぎました。確認後に1080p処理を送信してください')
        break
      case 'veo-4k':
        openWorkflow('video', 'veo/4k', { taskId: item.taskId, index: 0 }, '元タスクを引き継ぎました。確認後に4K処理を送信してください')
        break
      case 'lip-sync':
        openWorkflow('video', 'market/volcengine-lip-sync', {
          video_url: url,
          audio_url: options.audioUrl,
        }, '動画と音声を引き継ぎました。尺の扱いを確認してから送信してください')
        break
      case 'market-upscale':
        if (media.kind === 'video') {
          openWorkflow('video', 'topaz/video-upscale', { video_url: url }, '元動画を引き継ぎました。倍率を確認してから送信してください')
        } else {
          openWorkflow('image', 'topaz/image-upscale', { image_url: url }, '元画像を引き継ぎました。倍率を確認してから送信してください')
        }
        break
      case 'market-edit':
        if (media.kind === 'video') {
          openWorkflow('video', 'wan/2-7-videoedit', { video_url: url, prompt: '' }, '元動画を引き継ぎました。編集内容を入力してから送信してください')
        } else {
          openWorkflow('image', 'google/nano-banana-edit', { image_urls: [url], prompt: '' }, '元画像を引き継ぎました。編集内容を入力してから送信してください')
        }
        break
      default: {
        const exhaustive: never = action
        return exhaustive
      }
    }
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
    setMobileView('create')
  }

  function togglePin(taskId: string) {
    const result = togglePinInList(history, taskId)
    if (result.rejected === 'pin-limit') {
      setFormError(`ピン留めは最大${MAX_PINNED}件までです`)
      return
    }
    setHistory(result.next)
    requestHistoryPersist('immediate')
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
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : '履歴のインポートに失敗しました',
        )
      }
    })()
  }

  function closeViewer() {
    setViewerTaskId(null)
  }

  function confirmDiscardForm(): boolean {
    if (!selected) return true
    if (!isFormDirty(selected.fields, values)) return true
    return window.confirm(
      '入力内容が消えます。モデルまたはカテゴリを切り替えてもよろしいですか？',
    )
  }

  function handleFieldChange(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }))
    setFormNotice(null)
    setFieldErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  return (
    <AudioPlayerProvider>
      <StudioShell
      mobileView={mobileView}
      historyCount={history.length}
      pendingCount={pendingCount}
      onMobileViewChange={setMobileView}
      chromeTitle={
        <>
          KIE <span className="text-[var(--accent)]">STUDIO</span>
        </>
      }
      chromeSubtitle="kie.ai · IMAGE / VIDEO / AUDIO"
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
      chromeTrailing={
        <div className="flex items-stretch gap-1.5 sm:gap-2">
          <CreditBadge lastUsed={lastUsedCredits} />
          <Pressable
            onClick={() => setSettingsSheetOpen(true)}
            className="studio-btn shrink-0 self-stretch px-2.5"
            aria-label="設定を開く"
            scaleTo={0.96}
          >
            <Settings size={16} strokeWidth={2} aria-hidden />
          </Pressable>
        </div>
      }
      form={
        <>
          <div className="sticky top-0 z-[var(--z-sticky)] -mx-5 -mt-5 mb-2 shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 pt-5 pb-4">
            <CategoryTabs
              value={category}
              disabled={submitting}
              onChange={(c) => {
                if (c === category) return true
                if (!confirmDiscardForm()) return false
                pendingRestoreRef.current = null
                setFormNotice(null)
                setCategory(c)
                setModelId(null)
                return true
              }}
            />
          </div>

          {modelsQuery.isLoading ? (
            <p className="text-sm text-[var(--text-muted)]">モデル読込中…</p>
          ) : modelsQuery.isError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {(modelsQuery.error as Error).message}
            </p>
          ) : (
            <ModelSelect
              models={models}
              value={selected?.id ?? null}
              onChange={(id) => {
                if (id === selected?.id) return
                if (!confirmDiscardForm()) return
                pendingRestoreRef.current = null
                setFormNotice(null)
                setModelId(id)
              }}
              disabled={submitting}
            />
          )}

          {selected ? (
            <>
              <div id="panel-image" hidden={category !== 'image'} />
              <div id="panel-video" hidden={category !== 'video'} />
              <div id="panel-audio" hidden={category !== 'audio'} />
              {selected.docsUrl && (
                <a
                  href={selected.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-8 items-center gap-1 self-start py-1 text-xs font-medium text-[var(--accent)]"
                >
                  ドキュメント
                  <ExternalLink size={12} strokeWidth={2} aria-hidden />
                </a>
              )}

              <DynamicForm
                key={selected.id}
                fields={selected.fields}
                values={values}
                onChange={handleFieldChange}
                disabled={submitting}
                fieldErrors={fieldErrors}
                modelId={selected.id}
              />

              {selected.provider === 'suno' && values.customMode !== false && selected.fields.some((field) => field.name === 'style') && (
                <SunoStyleAssist
                  value={typeof values.style === 'string' ? values.style : ''}
                  disabled={submitting}
                  onApply={(next) => handleFieldChange('style', next)}
                />
              )}

              {selected.provider === 'suno' && values.customMode !== false && selected.fields.some((field) => field.name === 'personaId') && (personasQuery.data?.length ?? 0) > 0 && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <label htmlFor="saved-persona" className="studio-label">素材棚 · Persona</label>
                  <select
                    id="saved-persona"
                    className="studio-select mt-2 w-full"
                    value={typeof values.personaId === 'string' ? values.personaId : ''}
                    onChange={(event) => handleFieldChange('personaId', event.target.value)}
                    disabled={submitting}
                  >
                    <option value="">Personaを使わない</option>
                    {personasQuery.data?.map((saved) => (
                      <option key={saved.id} value={saved.personaId}>{saved.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selected.provider === 'suno' && selected.fields.some((field) => field.name === 'uploadUrl') && (audioAssetsQuery.data?.length ?? 0) > 0 && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <span className="studio-label">素材棚 · 外部音源</span>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {audioAssetsQuery.data?.map((asset) => {
                      const expired = typeof asset.expiresAt === 'number' && asset.expiresAt <= Date.now()
                      const selectedAsset = Array.isArray(values.uploadUrl) && values.uploadUrl.includes(asset.url)
                      return (
                        <Pressable
                          key={asset.id}
                          disabled={submitting || expired}
                          aria-pressed={selectedAsset}
                          className={`studio-chip min-w-36 justify-start ${selectedAsset ? 'is-active' : ''}`}
                          onClick={() => handleFieldChange('uploadUrl', [asset.url])}
                          scaleTo={0.97}
                        >
                          <span className="line-clamp-1">{asset.name}</span>
                          <span className="ml-1 text-[9px] opacity-70">{expired ? '期限切れ' : '選択'}</span>
                        </Pressable>
                      )
                    })}
                  </div>
                </div>
              )}

              {formError && (
                <div className="text-sm text-[var(--danger)]" role="alert">
                  <p>{formError}</p>
                </div>
              )}

              {formNotice && !formError && (
                <p
                  className="text-sm text-[var(--accent)]"
                  role="status"
                  aria-live="polite"
                >
                  {formNotice}
                </p>
              )}

              {!hasApiKey && !healthQuery.isLoading && (
                <div
                  className="flex flex-wrap items-center gap-2 text-sm text-[var(--warning)]"
                  role="status"
                >
                  <span>API キー未設定のため生成できません。</span>
                  <Pressable
                    onClick={() => setSettingsSheetOpen(true)}
                    className="studio-btn w-auto gap-1 px-3 text-xs"
                    scaleTo={0.96}
                  >
                    <Settings size={13} strokeWidth={2} aria-hidden />
                    設定画面を開く
                  </Pressable>
                </div>
              )}

              {pendingCount > 0 && (
                <p className="text-xs text-[var(--warning)]" role="status">
                  API受付済み {pendingTasks.filter((item) => item.state === 'waiting' || item.state === 'queuing').length} 件
                  {' · '}生成中 {pendingTasks.filter((item) => item.state === 'generating' || item.state === 'unknown').length} 件
                </p>
              )}

              {submissionQueueItems.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                  <span role="status">
                    未送信 {submissionQueueItems.filter((item) => item.state === 'unsent').length} 件
                    {' · '}API受付済み {submissionQueueItems.filter((item) => item.state === 'accepted').length} 件
                  </span>
                  {submissionQueueItems.some((item) => item.state === 'unsent') && (
                    <Pressable
                      className="studio-btn"
                      onClick={() => submissionQueue.cancelUnsent()}
                      scaleTo={0.97}
                    >
                      未送信をキャンセル
                    </Pressable>
                  )}
                </div>
              )}

              <div className="studio-sticky-cta space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="min-w-0 truncate font-medium text-[var(--text)]">
                    {selected.title}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {creditEstimate === null
                      ? 'クレジット推定なし'
                      : `約${creditEstimate * batchCount} cr`}
                  </span>
                </div>
                {formIssues.length > 0 && (
                  <button
                    type="button"
                    className="block w-full cursor-pointer text-left text-[11px] leading-snug text-[var(--warning)] underline decoration-transparent underline-offset-2 hover:decoration-current"
                    onClick={() => {
                      setFieldErrors(currentFormErrors)
                      requestAnimationFrame(() => focusFirstFieldError(currentFormErrors))
                    }}
                  >
                    要確認: {formIssues.slice(0, 3).join('、')}
                    {formIssues.length > 3 ? ` ほか${formIssues.length - 3}項目` : ''}
                    <span className="ml-1">最初の項目へ</span>
                  </button>
                )}
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
                </div>
                <Pressable
                  disabled={generateDisabled}
                  onClick={() => {
                    setFormNotice(null)
                    generate.mutate({ source: 'form' })
                  }}
                  className="studio-btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  scaleTo={0.96}
                  aria-busy={submitting || undefined}
                >
                  {submitting
                    ? '送信中…'
                    : batchCount > 1
                      ? `生成 ×${batchCount}`
                      : '生成'}
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
          activeCategory={category}
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
          onUpdateItem={updateHistoryItem}
          onQuickAction={quickAction}
          retryDisabled={generateDisabled}
          onRemove={(taskId) => {
            setHistory((prev) => removeFromList(prev, taskId))
            requestHistoryPersist('immediate')
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
            setHistory((prev) => prev.filter((h) => h.pinned))
            requestHistoryPersist('immediate')
            setViewerTaskId(null)
          }}
        />
      }
      />
      {creditSheetRequested && (
        <Suspense fallback={null}>
          <CreditPurchaseSheet
            open={creditPurchaseSheetOpen}
            onClose={() => setCreditPurchaseSheetOpen(false)}
          />
        </Suspense>
      )}
      {settingsSheetRequested && (
        <Suspense fallback={null}>
          <SettingsSheet
            open={settingsSheetOpen}
            onClose={() => setSettingsSheetOpen(false)}
          />
        </Suspense>
      )}
    </AudioPlayerProvider>
  )
}
