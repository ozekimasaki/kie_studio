export type ModelCategory = 'image' | 'video'

export type FieldType =
  | 'string'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'reference'
  | 'json'

export interface FieldSchema {
  name: string
  type: FieldType
  label: string
  description?: string
  required?: boolean
  default?: unknown
  enum?: string[]
  min?: number
  max?: number
  step?: number
  maxItems?: number
  maxLength?: number
  accept?: string
}

export interface ModelDefinition {
  id: string
  model: string
  title: string
  category: ModelCategory
  provider: 'market'
  docsUrl?: string
  fields: FieldSchema[]
}

export interface Catalog {
  syncedAt: string | null
  source: string
  models: ModelDefinition[]
}

export type TaskState =
  | 'waiting'
  | 'queuing'
  | 'generating'
  | 'success'
  | 'fail'
  | 'unknown'

export interface NormalizedTask {
  taskId: string
  state: TaskState
  model?: string
  resultUrls: string[]
  failMsg?: string
  costTime?: number
  createTime?: number
  creditsConsumed?: number
  raw?: unknown
}

export interface HistoryItem {
  taskId: string
  model: string
  category: ModelCategory
  state: TaskState
  createdAt: number
  resultUrls?: string[]
  prompt?: string
  creditsConsumed?: number
}
