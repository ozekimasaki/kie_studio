import type { ModelCategory } from '../lib/models/types.ts'
import { Pressable } from './motion/Pressable.tsx'

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
    <div
      role="tablist"
      aria-label="モデルカテゴリ"
      className="flex w-full shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)]"
    >
      {TABS.map((tab) => {
        const active = tab.id === value
        return (
          <Pressable
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            scaleTo={0.98}
            className={`flex min-h-10 flex-1 cursor-pointer items-center justify-center px-3 py-2.5 text-[0.8125rem] font-semibold transition-colors duration-150 ease-out ${
              active
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-raised)]'
            }`}
          >
            {tab.label}
          </Pressable>
        )
      })}
    </div>
  )
}
