import type {
  AlignedWord,
  Catalog,
  FieldSchema,
  FieldType,
  HistoryItem,
  MediaAsset,
  ModelCategory,
  ModelDefinition,
  NormalizedTask,
  Operation,
  Provider,
  SavedPersona,
  SavedAudioAsset,
  SubmissionQueueItem,
  TaskState,
} from './models/types.ts'

export type {
  AlignedWord,
  Catalog,
  FieldSchema,
  FieldType,
  HistoryItem,
  MediaAsset,
  ModelCategory,
  ModelDefinition,
  NormalizedTask,
  Operation,
  Provider,
  SavedPersona,
  SavedAudioAsset,
  SubmissionQueueItem,
  TaskState,
}

export class ApiClientError extends Error {
  status: number
  code?: number

  constructor(message: string, status: number, code?: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

/**
 * Resolve the API base URL.
 * - dev / web (http(s) origin): relative path, proxied by Vite to the server.
 * - packaged webview (views:// or null origin): absolute 127.0.0.1 URL, using
 *   the port handed over via the `apiPort` query string (default 8787).
 * - override with VITE_API_BASE when needed.
 */
const API_BASE: string =
  import.meta.env.VITE_API_BASE ??
  (location.protocol.startsWith('http')
    ? ''
    : `http://127.0.0.1:${new URLSearchParams(location.search).get('apiPort') ?? '8787'}`)

export const apiUrl = (path: string): string => `${API_BASE}${path}`

async function parseJson<T>(res: Response): Promise<T> {
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new ApiClientError(`Request failed (${res.status})`, res.status)
  }
  if (!res.ok) {
    const err = data as { error?: string; code?: number }
    throw new ApiClientError(
      err.error || `Request failed (${res.status})`,
      res.status,
      err.code,
    )
  }
  return data as T
}

export async function fetchModels(category?: ModelCategory) {
  const q = category ? `?category=${category}` : ''
  const res = await fetch(apiUrl(`/api/models${q}`))
  return parseJson<{
    data: {
      syncedAt: string | null
      source: string
      models: ModelDefinition[]
    }
  }>(res)
}

export async function fetchCredits() {
  const res = await fetch(apiUrl('/api/credits'))
  return parseJson<{ data: { credits: number } }>(res)
}

export async function fetchHealth() {
  const res = await fetch(apiUrl('/api/health'))
  return parseJson<{ ok: boolean; hasKey: boolean }>(res)
}

export async function uploadFile(file: File): Promise<string> {
  return (await uploadFileWithMetadata(file)).fileUrl
}

export async function uploadFileWithMetadata(file: File): Promise<{
  fileUrl: string
  fileName?: string
  originalFileName: string
  expiresAt?: string
}> {
  const form = new FormData()
  form.append('file', file)
  form.append('uploadPath', 'kie-studio')
  form.append('fileName', file.name)
  const res = await fetch(apiUrl('/api/upload'), { method: 'POST', body: form })
  const json = await parseJson<{
    data: {
      fileUrl: string
      fileName?: string
      originalFileName?: string
      expiresAt?: string
    }
  }>(res)
  return { ...json.data, originalFileName: json.data.originalFileName ?? file.name }
}

export async function generateTask(params: {
  model: string
  input: Record<string, unknown>
  provider?: Provider
  operation?: Operation
}) {
  const res = await fetch(apiUrl('/api/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJson<{
    data: {
      taskId: string
      task?: NormalizedTask
    }
  }>(res)
}

export async function fetchTask(
  taskId: string,
  provider: Provider = 'market',
  operation: Operation = 'generate',
) {
  const query = new URLSearchParams({ taskId, provider, operation })
  const res = await fetch(apiUrl(`/api/task?${query}`))
  return parseJson<{ data: NormalizedTask }>(res)
}

export async function fetchTimestampedLyrics(taskId: string, audioId: string) {
  const res = await fetch(apiUrl('/api/suno/timestamped-lyrics'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, audioId }),
  })
  return parseJson<{
    data: {
      alignedWords: AlignedWord[]
      waveformData: number[]
    }
  }>(res)
}

export async function boostMusicStyle(style: string) {
  const res = await fetch(apiUrl('/api/suno/style'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style }),
  })
  return parseJson<{ data: { result: string } }>(res)
}

export async function createPersona(params: {
  taskId: string
  audioId: string
  name: string
  description?: string
}) {
  const res = await fetch(apiUrl('/api/suno/persona'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJson<{
    data: SavedPersona
  }>(res)
}

export async function fetchPersonas() {
  const res = await fetch(apiUrl('/api/personas'))
  return parseJson<{
    data: { items: SavedPersona[] }
  }>(res)
}

export async function deletePersona(id: string) {
  const res = await fetch(apiUrl(`/api/personas/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  })
  return parseJson<{ data: { removed: true } }>(res)
}

export async function fetchAudioAssets() {
  const res = await fetch(apiUrl('/api/audio-assets'))
  return parseJson<{ data: { items: SavedAudioAsset[] } }>(res)
}

export async function deleteAudioAsset(id: string) {
  const res = await fetch(apiUrl(`/api/audio-assets/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  })
  return parseJson<{ data: { removed: true } }>(res)
}

export async function downloadArchive(items: Array<{
  url: string
  name?: string
  lyrics?: string
}>) {
  const res = await fetch(apiUrl('/api/archive'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    let message = `Archive failed (${res.status})`
    try {
      const data = await res.json() as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Keep the HTTP fallback.
    }
    throw new ApiClientError(message, res.status)
  }
  const blob = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition')
  const fileName = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
    ?? 'kie-studio.zip'
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function fetchDownloadUrl(url: string) {
  const res = await fetch(apiUrl('/api/download-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return parseJson<{ data: { downloadUrl: string } }>(res)
}

export async function fetchGrokStatus() {
  const res = await fetch(apiUrl('/api/grok/status'))
  return parseJson<{
    data: { available: boolean; version?: string }
  }>(res)
}

export async function fetchOptimizeProfile(modelId?: string | null) {
  const q = modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''
  const res = await fetch(apiUrl(`/api/optimize-profile${q}`))
  return parseJson<{
    data: {
      family: string
      label: string
      modality: 'image' | 'video'
      formula: string
      mention: string
      hasGuide: boolean
    }
  }>(res)
}

export async function optimizePrompt(params: {
  prompt?: string
  customInstructions?: string
  modelId?: string
  mode: 'generate' | 'optimize'
}) {
  const res = await fetch(apiUrl('/api/optimize-prompt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJson<{
    data: {
      optimizedPrompt: string
      mode?: 'generate' | 'optimize'
      profile?: { family: string; label: string }
    }
  }>(res)
}

export async function fetchHistory() {
  const res = await fetch(apiUrl('/api/history'))
  return parseJson<{
    data: { items: HistoryItem[]; count: number }
  }>(res)
}

export async function putHistory(
  items: HistoryItem[],
) {
  const res = await fetch(apiUrl('/api/history'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  return parseJson<{
    data: { items: HistoryItem[] }
  }>(res)
}

export async function importHistoryApi(
  items: HistoryItem[],
) {
  const res = await fetch(apiUrl('/api/history/import'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  return parseJson<{
    data: { items: HistoryItem[] }
  }>(res)
}

export async function migrateHistory(items: unknown[]) {
  const res = await fetch(apiUrl('/api/history/migrate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  return parseJson<{
    data: { items: HistoryItem[] }
  }>(res)
}

export type AppSettings = {
  hasApiKey: boolean
  apiKeyMasked: string | null
  apiKeyFromStore: boolean
}

export async function fetchSettings() {
  const res = await fetch(apiUrl('/api/settings'))
  return parseJson<{ data: AppSettings }>(res)
}

export async function saveApiKey(apiKey: string) {
  const res = await fetch(apiUrl('/api/settings/api-key'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  return parseJson<{ data: { hasApiKey: boolean; apiKeyMasked: string } }>(res)
}

export async function clearApiKey() {
  const res = await fetch(apiUrl('/api/settings/api-key'), {
    method: 'DELETE',
  })
  return parseJson<{ data: { hasApiKey: boolean } }>(res)
}
