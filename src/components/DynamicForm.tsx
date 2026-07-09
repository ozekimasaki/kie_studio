import { useMemo, useRef } from 'react'
import type { FieldSchema, KlingElement, MentionStyle } from '../lib/models/types.ts'
import { insertMentionToken } from '../lib/models/mentions.ts'
import { ReferenceUpload } from './ReferenceUpload.tsx'
import { KlingElementsEditor } from './KlingElementsEditor.tsx'

function fieldId(name: string): string {
  return `field-${name}`
}

function acceptHint(accept?: string): string | null {
  if (!accept) return null
  if (/video/i.test(accept) && /image/i.test(accept)) return '画像・動画'
  if (/video/i.test(accept)) return '動画'
  if (/audio/i.test(accept)) return '音声'
  if (/image/i.test(accept)) return '画像'
  return null
}

function FieldLabel({
  field,
  htmlFor,
  hint,
}: {
  field: FieldSchema
  htmlFor?: string
  hint?: string | null
}) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-1 text-[var(--danger)]">*</span>}
        {hint && (
          <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
            {hint}
          </span>
        )}
      </label>
      {field.description && (
        <span
          className="max-w-[55%] truncate text-[11px] text-[var(--text-muted)]"
          title={field.description}
        >
          {field.description}
        </span>
      )}
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 text-xs text-[var(--danger)]" role="alert">
      {message}
    </p>
  )
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-50'
const inputErrorClass = 'border-[var(--danger)] focus:border-[var(--danger)]'

function resolveMentionStyle(field: FieldSchema): MentionStyle {
  if (field.mentionStyle) return field.mentionStyle
  const hay = `${field.name} ${field.description ?? ''}`.toLowerCase()
  if (hay.includes('[image')) return 'bracket-image'
  if (hay.includes('@image')) return 'at-image'
  if (/(image_?urls?|input_?urls?|reference_?urls?)/i.test(field.name)) {
    return 'at-image'
  }
  return 'none'
}

/** Display order: media refs → prompt → rest (payload keys unchanged). */
export function sortFieldsForDisplay(fields: FieldSchema[]): FieldSchema[] {
  const media: FieldSchema[] = []
  const prompts: FieldSchema[] = []
  const rest: FieldSchema[] = []

  for (const field of fields) {
    if (field.type === 'reference' || field.type === 'kling_elements') {
      media.push(field)
    } else if (field.type === 'textarea') {
      prompts.push(field)
    } else {
      rest.push(field)
    }
  }

  prompts.sort((a, b) => {
    if (a.name === 'prompt') return -1
    if (b.name === 'prompt') return 1
    return 0
  })

  return [...media, ...prompts, ...rest]
}

export function DynamicForm({
  fields,
  values,
  onChange,
  disabled,
  fieldErrors,
}: {
  fields: FieldSchema[]
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  disabled?: boolean
  fieldErrors?: Record<string, string>
}) {
  const promptRef = useRef<HTMLTextAreaElement | null>(null)
  const orderedFields = useMemo(() => sortFieldsForDisplay(fields), [fields])
  const promptFieldName =
    fields.find((f) => f.name === 'prompt' && f.type === 'textarea')?.name ??
    fields.find((f) => f.type === 'textarea')?.name ??
    null

  function insertIntoPrompt(token: string) {
    if (!promptFieldName) return
    const current =
      typeof values[promptFieldName] === 'string'
        ? (values[promptFieldName] as string)
        : ''
    const cursor = promptRef.current?.selectionStart ?? current.length
    const { next, cursor: nextCursor } = insertMentionToken(
      current,
      token,
      cursor,
    )
    onChange(promptFieldName, next)
    requestAnimationFrame(() => {
      const el = promptRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(nextCursor, nextCursor)
    })
  }

  function clearErrorOnChange(name: string, value: unknown) {
    onChange(name, value)
  }

  return (
    <div className="space-y-4">
      {orderedFields.map((field) => {
        const value = values[field.name]
        const error = fieldErrors?.[field.name]
        const id = fieldId(field.name)
        const errBorder = error ? inputErrorClass : ''

        switch (field.type) {
          case 'textarea':
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} />
                <textarea
                  id={id}
                  ref={
                    field.name === promptFieldName ? promptRef : undefined
                  }
                  className={`${inputClass} min-h-28 resize-y ${errBorder}`}
                  value={typeof value === 'string' ? value : ''}
                  maxLength={field.maxLength}
                  disabled={disabled}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(e) =>
                    clearErrorOnChange(field.name, e.target.value)
                  }
                  placeholder={
                    field.name === 'prompt'
                      ? '例: @image1 を参照して… / @element_dog が走る'
                      : field.label
                  }
                />
                <FieldError message={error} />
              </div>
            )
          case 'string':
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} />
                <input
                  id={id}
                  type="text"
                  className={`${inputClass} ${errBorder}`}
                  value={typeof value === 'string' ? value : ''}
                  maxLength={field.maxLength}
                  disabled={disabled}
                  aria-invalid={Boolean(error)}
                  onChange={(e) =>
                    clearErrorOnChange(field.name, e.target.value)
                  }
                />
                <FieldError message={error} />
              </div>
            )
          case 'number':
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} />
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="flex-1 accent-[var(--accent)]"
                    min={field.min ?? 0}
                    max={field.max ?? 100}
                    step={field.step ?? 1}
                    disabled={disabled}
                    aria-label={field.label}
                    value={
                      typeof value === 'number'
                        ? value
                        : Number(field.default ?? field.min ?? 0)
                    }
                    onChange={(e) =>
                      clearErrorOnChange(field.name, Number(e.target.value))
                    }
                  />
                  <input
                    id={id}
                    type="number"
                    className={`${inputClass} w-24 ${errBorder}`}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    value={
                      typeof value === 'number'
                        ? value
                        : Number(field.default ?? 0)
                    }
                    onChange={(e) =>
                      clearErrorOnChange(field.name, Number(e.target.value))
                    }
                  />
                </div>
                <FieldError message={error} />
              </div>
            )
          case 'boolean': {
            const on = Boolean(value)
            return (
              <div
                key={field.name}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium" id={id}>
                      {field.label}
                      {field.required && (
                        <span className="ml-1 text-[var(--danger)]">*</span>
                      )}
                    </div>
                    {field.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-muted)]">
                        {field.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-wide ${
                      on
                        ? 'bg-[var(--on-soft)] text-[var(--on)]'
                        : 'bg-[var(--off-soft)] text-[var(--off)]'
                    }`}
                  >
                    {on ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div
                  role="group"
                  aria-labelledby={id}
                  className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--bg)] p-1"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={!on}
                    onClick={() => clearErrorOnChange(field.name, false)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      !on
                        ? 'bg-[var(--bg-elevated)] text-[var(--text)] shadow-sm ring-1 ring-[var(--border)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    Off
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => clearErrorOnChange(field.name, true)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      on
                        ? 'bg-[var(--on)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    On
                  </button>
                </div>
                <FieldError message={error} />
              </div>
            )
          }
          case 'enum':
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} />
                <select
                  id={id}
                  className={`${inputClass} ${errBorder}`}
                  value={
                    typeof value === 'string'
                      ? value
                      : String(field.default ?? field.enum?.[0] ?? '')
                  }
                  disabled={disabled}
                  aria-invalid={Boolean(error)}
                  onChange={(e) =>
                    clearErrorOnChange(field.name, e.target.value)
                  }
                >
                  {(field.enum ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <FieldError message={error} />
              </div>
            )
          case 'reference': {
            const max = field.maxItems ?? 8
            const media = acceptHint(field.accept)
            const hint = [
              `最大 ${max} 枚`,
              media,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} hint={hint} />
                <ReferenceUpload
                  inputId={id}
                  value={Array.isArray(value) ? (value as string[]) : []}
                  onChange={(urls) => clearErrorOnChange(field.name, urls)}
                  maxItems={max}
                  accept={field.accept}
                  disabled={disabled}
                  mentionStyle={resolveMentionStyle(field)}
                  onInsertMention={
                    promptFieldName ? insertIntoPrompt : undefined
                  }
                />
                <FieldError message={error} />
              </div>
            )
          }
          case 'kling_elements':
            return (
              <div key={field.name}>
                <FieldLabel
                  field={field}
                  hint={`最大 ${field.maxItems ?? 3} 件`}
                />
                <KlingElementsEditor
                  value={Array.isArray(value) ? (value as KlingElement[]) : []}
                  onChange={(next) => clearErrorOnChange(field.name, next)}
                  maxItems={field.maxItems ?? 3}
                  disabled={disabled}
                  onInsertMention={
                    promptFieldName ? insertIntoPrompt : undefined
                  }
                />
                <FieldError message={error} />
              </div>
            )
          case 'json':
            return (
              <div key={field.name}>
                <FieldLabel field={field} htmlFor={id} />
                <textarea
                  id={id}
                  className={`${inputClass} min-h-24 font-mono text-xs ${errBorder}`}
                  disabled={disabled}
                  aria-invalid={Boolean(error)}
                  value={
                    typeof value === 'string'
                      ? value
                      : value !== undefined
                        ? JSON.stringify(value, null, 2)
                        : ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value
                    try {
                      clearErrorOnChange(field.name, JSON.parse(raw))
                    } catch {
                      clearErrorOnChange(field.name, raw)
                    }
                  }}
                  placeholder="{ }"
                />
                <FieldError message={error} />
              </div>
            )
          default: {
            const _exhaustive: never = field.type
            return _exhaustive
          }
        }
      })}
    </div>
  )
}

export function buildDefaultValues(
  fields: FieldSchema[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default
      continue
    }
    switch (field.type) {
      case 'boolean':
        values[field.name] = false
        break
      case 'reference':
      case 'kling_elements':
        values[field.name] = []
        break
      case 'number':
        values[field.name] = field.min ?? 0
        break
      case 'enum':
        values[field.name] = field.enum?.[0] ?? ''
        break
      default:
        values[field.name] = ''
    }
  }
  return values
}

export function validateFields(
  fields: FieldSchema[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    if (!field.required) continue
    const v = values[field.name]
    if (v === undefined || v === null || v === '') {
      errors[field.name] = `${field.label}は必須です`
      continue
    }
    if (field.type === 'reference' && Array.isArray(v) && v.length === 0) {
      errors[field.name] = `${field.label}は必須です`
    }
    if (
      field.type === 'kling_elements' &&
      Array.isArray(v) &&
      v.length === 0
    ) {
      errors[field.name] = `${field.label}は必須です`
    }
  }
  return errors
}
