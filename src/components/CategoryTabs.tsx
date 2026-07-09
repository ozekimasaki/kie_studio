import type { ModelCategory } from '../lib/models/types.ts'

const TABS: { id: ModelCategory; label: string }[] = [
  { id: 'image', label: 'IMAGE' },
  { id: 'video', label: 'VIDEO' },
]

export function CategoryTabs({
  value,
  onChange,
}: {
  value: ModelCategory
  onChange: (v: ModelCategory) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-1">
      {TABS.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold tracking-wide transition ${
              active
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-black/5 hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
