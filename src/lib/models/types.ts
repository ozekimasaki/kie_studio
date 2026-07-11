export type ModelCategory = 'image' | 'video'

export type FieldType =
  | 'string'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'reference'
  | 'kling_elements'
  | 'json'

/** How to mention uploaded references inside the prompt */
export type MentionStyle =
  | 'at-image'
  | 'at-video'
  | 'at-audio'
  | 'bracket-image'
  | 'none'

export interface KlingElement {
  name: string
  description: string
  element_input_urls: string[]
  element_input_audio_urls?: string[]
  start_time?: number
  end_time?: number
}

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
  /** For reference fields: how to insert into prompt */
  mentionStyle?: MentionStyle
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
  failMsg?: string
  /** Catalog model id — used to restore the form (再利用/リトライ) */
  modelId?: string
  /** Full generation input — enables 再利用・リトライ・全文プロンプト表示 */
  input?: Record<string, unknown>
  /** ピン留め: 最大件数の押し出しと「すべて削除」の対象外 */
  pinned?: boolean
}
