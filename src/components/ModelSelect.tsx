import type { ModelDefinition } from '../lib/models/types.ts'

export function ModelSelect({
  models,
  value,
  onChange,
  disabled,
}: {
  models: ModelDefinition[]
  value: string | null
  onChange: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        Model
      </label>
      <select
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-50"
        value={value ?? ''}
        disabled={disabled || models.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {models.length === 0 && <option value="">モデルなし</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.title}
          </option>
        ))}
      </select>
      {value && (
        <p className="truncate font-mono text-[11px] text-[var(--text-muted)]">
          {models.find((m) => m.id === value)?.model}
        </p>
      )}
    </div>
  )
}
