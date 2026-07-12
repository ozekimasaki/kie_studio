import type { ReactNode } from 'react'
import { LayoutGroup } from 'motion/react'
import { Material } from '../motion/Material.tsx'
import { FloatingChrome } from './FloatingChrome.tsx'

/**
 * IA locked: left create form · right gallery.
 * Precision Light — solid surfaces, h-dvh workspace.
 * Mobile: capped form height so gallery stays in viewport.
 */
export function StudioShell({
  chromeTitle,
  chromeSubtitle,
  chromeMeta,
  chromeTrailing,
  form,
  canvas,
}: {
  chromeTitle: ReactNode
  chromeSubtitle?: ReactNode
  chromeMeta?: ReactNode
  chromeTrailing?: ReactNode
  form: ReactNode
  canvas: ReactNode
}) {
  return (
    <LayoutGroup>
      <div className="mx-auto flex h-dvh max-w-[1600px] flex-col gap-3 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:gap-4 md:p-4">
        <FloatingChrome
          title={chromeTitle}
          subtitle={chromeSubtitle}
          meta={chromeMeta}
          trailing={chromeTrailing}
        />

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,45dvh)_minmax(0,1fr)] gap-3 overflow-hidden lg:grid-cols-[minmax(380px,440px)_1fr] lg:grid-rows-none">
          <Material
            weight="panel"
            className="material-panel-heavy flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-xl)]"
            initial={false}
            role="complementary"
            aria-label="作成フォーム"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-5 pb-3">
              {form}
            </div>
          </Material>

          <Material
            weight="panel"
            className="flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-xl)]"
            initial={false}
            role="main"
            aria-label="生成履歴"
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 md:p-4">
              {canvas}
            </div>
          </Material>
        </div>
      </div>
    </LayoutGroup>
  )
}
