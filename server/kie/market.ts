import { assertKieOk, KieApiError, kieFetch } from './client.ts'
import type { NormalizedTask, TaskState } from './types.ts'

interface CreateTaskResponse {
  code: number
  msg: string
  data?: { taskId: string }
}

interface RecordInfoResponse {
  code: number
  msg: string
  data?: {
    taskId?: string
    model?: string
    state?: string
    resultJson?: string
    failCode?: string | null
    failMsg?: string | null
    costTime?: number
    completeTime?: number
    createTime?: number
    creditsConsumed?: number
    consumeCredits?: number
    credit?: number
  }
}

export async function createTask(params: {
  model: string
  input: Record<string, unknown>
  callBackUrl?: string
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: params.model,
    input: params.input,
  }
  if (params.callBackUrl) body.callBackUrl = params.callBackUrl

  const res = await kieFetch<CreateTaskResponse>('/api/v1/jobs/createTask', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  assertKieOk(res.code, res.msg, 'Failed to create task')
  if (!res.data?.taskId) {
    throw new KieApiError('Failed to create task', 502, res.code)
  }
  return res.data.taskId
}

function normalizeState(state?: string): TaskState {
  switch (state) {
    case 'waiting':
    case 'queuing':
    case 'generating':
    case 'success':
    case 'fail':
      return state
    default:
      return 'unknown'
  }
}

function parseResultUrls(resultJson?: string): string[] {
  if (!resultJson) return []
  try {
    const parsed = JSON.parse(resultJson) as {
      resultUrls?: string[]
      resultObject?: { resultUrls?: string[] }
    }
    if (Array.isArray(parsed.resultUrls)) return parsed.resultUrls
    if (Array.isArray(parsed.resultObject?.resultUrls)) {
      return parsed.resultObject.resultUrls
    }
    return []
  } catch {
    return []
  }
}

export async function getTaskDetail(taskId: string): Promise<NormalizedTask> {
  const res = await kieFetch<RecordInfoResponse>(
    `/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
  )

  assertKieOk(res.code, res.msg, 'Failed to get task detail')
  if (!res.data) {
    throw new KieApiError('Failed to get task detail', 502, res.code)
  }

  const data = res.data
  const creditsConsumed =
    typeof data.creditsConsumed === 'number'
      ? data.creditsConsumed
      : typeof data.consumeCredits === 'number'
        ? data.consumeCredits
        : typeof data.credit === 'number'
          ? data.credit
          : undefined

  return {
    taskId: data.taskId ?? taskId,
    state: normalizeState(data.state),
    model: data.model,
    resultUrls: parseResultUrls(data.resultJson),
    failMsg: data.failMsg ?? undefined,
    costTime: data.costTime,
    createTime: data.createTime,
    creditsConsumed,
  }
}
