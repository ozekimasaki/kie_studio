export const API_PORT_START = 8787
export const API_PORT_END = 8806
const HEALTH_TIMEOUT_MS = 400

export class CliError extends Error {
  exitCode: number
  hint?: string

  constructor(message: string, exitCode = 1, hint?: string) {
    super(message)
    this.name = 'CliError'
    this.exitCode = exitCode
    this.hint = hint
  }
}

export type FetchImpl = (
  input: string,
  init?: RequestInit,
) => Promise<Response>

async function healthOk(base: string, fetchImpl: FetchImpl): Promise<boolean> {
  try {
    const res = await fetchImpl(`${base}/api/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean }
    return body.ok === true
  } catch {
    return false
  }
}

export async function discoverApiBase(options: {
  envBase?: string
  fetchImpl?: FetchImpl
}): Promise<string | null> {
  const fetchImpl = options.fetchImpl ?? fetch
  const envBase = options.envBase?.trim()
  if (envBase) {
    const normalized = envBase.replace(/\/$/, '')
    return (await healthOk(normalized, fetchImpl)) ? normalized : null
  }
  const ports = Array.from(
    { length: API_PORT_END - API_PORT_START + 1 },
    (_, index) => API_PORT_START + index,
  )
  const found = await Promise.all(
    ports.map(async (port) => {
      const base = `http://127.0.0.1:${port}`
      return (await healthOk(base, fetchImpl)) ? base : null
    }),
  )
  return found.find((base) => base !== null) ?? null
}

export interface CatalogModel {
  id: string
  model: string
  title: string
  category: 'image' | 'video' | 'audio'
  provider: 'market' | 'suno' | 'veo' | 'runway'
  operation?: string
  fields?: { name: string; required?: boolean }[]
}

export interface GenerateResult {
  taskId: string
  task?: {
    state?: string
    resultUrls?: string[]
    media?: { kind: string; url?: string }[]
    failMsg?: string
  }
}

export interface TaskStatus {
  taskId: string
  state: string
  resultUrls: string[]
  media: { kind: string; url?: string; streamUrl?: string; localPath?: string }[]
  failMsg?: string
  provider?: string
  operation?: string
  creditsConsumed?: number
}

export interface HistoryRow {
  taskId: string
  model: string
  category: string
  state: string
  createdAt: number
  prompt?: string
  provider?: string
  operation?: string
  resultUrls?: string[]
}

export class StudioClient {
  base: string
  private fetchImpl: FetchImpl

  constructor(base: string, fetchImpl: FetchImpl = fetch) {
    this.base = base
    this.fetchImpl = fetchImpl
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    })
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    if (!res.ok) {
      const message =
        parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof parsed.error === 'string'
          ? parsed.error
          : text || `Request failed (${res.status})`
      throw new CliError(message, res.status >= 400 && res.status < 600 ? 1 : 1)
    }
    const body = parsed as { data?: T }
    return (body.data ?? body) as T
  }

  listModels(category?: string): Promise<{
    models: CatalogModel[]
  }> {
    const search = new URLSearchParams()
    if (category) search.set('category', category)
    const qs = search.toString()
    return this.request(`/api/models${qs ? `?${qs}` : ''}`)
  }

  generate(body: {
    model: string
    input: Record<string, unknown>
    provider: string
    operation: string
    workflowId?: string
  }): Promise<GenerateResult> {
    return this.request('/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  getTask(params: {
    taskId: string
    provider?: string
    operation?: string
  }): Promise<TaskStatus> {
    const search = new URLSearchParams({ taskId: params.taskId })
    if (params.provider) search.set('provider', params.provider)
    if (params.operation) search.set('operation', params.operation)
    return this.request(`/api/task?${search}`)
  }

  listHistory(): Promise<{ items: HistoryRow[]; count: number }> {
    return this.request('/api/history')
  }
}
