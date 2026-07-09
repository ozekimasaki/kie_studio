export type {
  Catalog,
  FieldSchema,
  FieldType,
  HistoryItem,
  ModelCategory,
  ModelDefinition,
  NormalizedTask,
  TaskState,
} from './models/types.ts'

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    const err = data as { error?: string }
    throw new Error(err.error || `Request failed (${res.status})`)
  }
  return data as T
}

export async function fetchModels(category?: 'image' | 'video') {
  const q = category ? `?category=${category}` : ''
  const res = await fetch(`/api/models${q}`)
  return parseJson<{
    data: {
      syncedAt: string | null
      source: string
      models: import('./models/types.ts').ModelDefinition[]
    }
  }>(res)
}

export async function fetchCredits() {
  const res = await fetch('/api/credits')
  return parseJson<{ data: { credits: number } }>(res)
}

export async function fetchHealth() {
  const res = await fetch('/api/health')
  return parseJson<{ ok: boolean; hasKey: boolean }>(res)
}

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('uploadPath', 'kie-studio')
  form.append('fileName', file.name)
  const res = await fetch('/api/upload', { method: 'POST', body: form })
  const json = await parseJson<{ data: { fileUrl: string } }>(res)
  return json.data.fileUrl
}

export async function generateTask(params: {
  model: string
  input: Record<string, unknown>
}) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return parseJson<{ data: { taskId: string } }>(res)
}

export async function fetchTask(taskId: string) {
  const res = await fetch(`/api/task?taskId=${encodeURIComponent(taskId)}`)
  return parseJson<{ data: import('./models/types.ts').NormalizedTask }>(res)
}

export async function fetchDownloadUrl(url: string) {
  const res = await fetch('/api/download-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return parseJson<{ data: { downloadUrl: string } }>(res)
}
