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
    <div className="space-y-2">
      <label htmlFor="model-select" className="studio-label">
        Model
      </label>
      <select
        id="model-select"
        className="studio-select w-full py-2.5"
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
