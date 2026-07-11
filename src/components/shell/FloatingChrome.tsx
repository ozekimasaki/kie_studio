import type { ReactNode } from 'react'
import { Material } from '../motion/Material.tsx'

export function FloatingChrome({
  title,
  subtitle,
  meta,
  trailing,
}: {
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <Material
      weight="chrome"
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] px-4 py-3 md:px-5"
      initial={false}
      role="banner"
    >
      <div className="min-w-0 space-y-0.5">
        <h1 className="studio-display">{title}</h1>
        {subtitle && <p className="studio-subtitle">{subtitle}</p>}
        {meta}
      </div>
      {trailing}
    </Material>
  )
}
