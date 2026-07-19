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
      className="flex shrink-0 items-center justify-between gap-2 rounded-[var(--radius-xl)] px-3 py-2.5 sm:px-4 sm:py-3 md:px-5"
      initial={false}
      role="banner"
    >
      <div className="min-w-0 shrink-0 space-y-0.5">
        <h1 className="studio-display">{title}</h1>
        {subtitle && <p className="studio-subtitle hidden sm:block">{subtitle}</p>}
        {meta && <div className="hidden sm:block">{meta}</div>}
      </div>
      <div className="ml-auto min-w-0">{trailing}</div>
    </Material>
  )
}
