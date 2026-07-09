import type { FieldSchema } from '../lib/models/types.ts'
import { ReferenceUpload } from './ReferenceUpload.tsx'

function FieldLabel({ field }: { field: FieldSchema }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label className="text-sm font-medium">
        {field.label}
        {field.required && <span className="ml-1 text-[var(--danger)]">*</span>}
      </label>
      {field.description && (
        <span className="max-w-[60%] truncate text-[11px] text-[var(--text-muted)]" title={field.description}>
          {field.description}
        </span>
      )}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)]'

export function DynamicForm({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: FieldSchema[]
  values: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = values[field.name]

        switch (field.type) {
          case 'textarea':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  value={typeof value === 'string' ? value : ''}
                  maxLength={field.maxLength}
                  disabled={disabled}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  placeholder={field.label}
                />
              </div>
            )
          case 'string':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <input
                  type="text"
                  className={inputClass}
                  value={typeof value === 'string' ? value : ''}
                  maxLength={field.maxLength}
                  disabled={disabled}
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
              </div>
            )
          case 'number':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    className="flex-1 accent-[var(--accent)]"
                    min={field.min ?? 0}
                    max={field.max ?? 100}
                    step={field.step ?? 1}
                    disabled={disabled}
                    value={typeof value === 'number' ? value : Number(field.default ?? field.min ?? 0)}
                    onChange={(e) => onChange(field.name, Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className={`${inputClass} w-24`}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    disabled={disabled}
                    value={typeof value === 'number' ? value : Number(field.default ?? 0)}
                    onChange={(e) => onChange(field.name, Number(e.target.value))}
                  />
                </div>
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
                    <div className="text-sm font-medium">
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
                  aria-label={field.label}
                  className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--bg)] p-1"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={!on}
                    onClick={() => onChange(field.name, false)}
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
                    onClick={() => onChange(field.name, true)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                      on
                        ? 'bg-[var(--on)] text-white shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    On
                  </button>
                </div>
              </div>
            )
          }
          case 'enum':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <select
                  className={inputClass}
                  value={typeof value === 'string' ? value : String(field.default ?? field.enum?.[0] ?? '')}
                  disabled={disabled}
                  onChange={(e) => onChange(field.name, e.target.value)}
                >
                  {(field.enum ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )
          case 'reference':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <ReferenceUpload
                  value={Array.isArray(value) ? (value as string[]) : []}
                  onChange={(urls) => onChange(field.name, urls)}
                  maxItems={field.maxItems ?? 8}
                  accept={field.accept}
                  disabled={disabled}
                />
              </div>
            )
          case 'json':
            return (
              <div key={field.name}>
                <FieldLabel field={field} />
                <textarea
                  className={`${inputClass} min-h-24 font-mono text-xs`}
                  disabled={disabled}
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
                      onChange(field.name, JSON.parse(raw))
                    } catch {
                      onChange(field.name, raw)
                    }
                  }}
                  placeholder="{ }"
                />
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

export function buildDefaultValues(fields: FieldSchema[]): Record<string, unknown> {
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
