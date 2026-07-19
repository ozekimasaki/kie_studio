import type { ReactNode } from 'react'
import { LayoutGroup } from 'motion/react'
import { Material } from '../motion/Material.tsx'
import { FloatingChrome } from './FloatingChrome.tsx'

export type MobileStudioView = 'create' | 'history'

/**
 * IA locked: left create form · right gallery.
 * Precision Light — solid surfaces, h-dvh workspace.
 * Mobile: one full-height surface at a time, switched by tabs.
 */
export function StudioShell({
  chromeTitle,
  chromeSubtitle,
  chromeMeta,
  chromeTrailing,
  form,
  canvas,
  mobileView,
  historyCount,
  pendingCount,
  onMobileViewChange,
}: {
  chromeTitle: ReactNode
  chromeSubtitle?: ReactNode
  chromeMeta?: ReactNode
  chromeTrailing?: ReactNode
  form: ReactNode
  canvas: ReactNode
  mobileView: MobileStudioView
  historyCount: number
  pendingCount?: number
  onMobileViewChange: (view: MobileStudioView) => void
}) {
  return (
    <LayoutGroup>
      <div className="mx-auto flex h-dvh max-w-[1600px] flex-col gap-2 overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] md:gap-4 md:p-4">
        <FloatingChrome
          title={chromeTitle}
          subtitle={chromeSubtitle}
          meta={chromeMeta}
          trailing={chromeTrailing}
        />

        <div className="shrink-0 lg:hidden">
          <div className="studio-segment" role="tablist" aria-label="表示内容">
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === 'create'}
              className={`studio-segment-item ${mobileView === 'create' ? 'bg-[var(--accent)] !text-[var(--on-accent)]' : ''}`}
              onClick={() => onMobileViewChange('create')}
            >
              作成
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileView === 'history'}
              className={`studio-segment-item gap-1.5 ${mobileView === 'history' ? 'bg-[var(--accent)] !text-[var(--on-accent)]' : ''}`}
              onClick={() => onMobileViewChange('history')}
            >
              履歴 <span className="tabular-nums">{historyCount}</span>
              {pendingCount ? (
                <span className="size-1.5 rounded-full bg-[var(--warning)]" aria-label={`${pendingCount}件生成中`} />
              ) : null}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[minmax(380px,440px)_1fr] lg:gap-3">
          <Material
            weight="panel"
            className={`material-panel-heavy min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] lg:flex ${mobileView === 'create' ? 'flex' : 'hidden'}`}
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
            className={`min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-xl)] lg:flex ${mobileView === 'history' ? 'flex' : 'hidden'}`}
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
