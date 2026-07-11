import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'
import {
  useEffect,
  useRef,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { project, springMomentum, springUi, fadeQuick } from '../../lib/motion.ts'

type SpringSheetProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Accessible name when no labelledby */
  label?: string
  labelledBy?: string
  className?: string
  /** Max width class, default max-w-3xl */
  maxWidthClass?: string
}

/**
 * Gesture-dismissible sheet: 1:1 drag down, velocity projection on release,
 * scrim opacity tracks drag. Interruptible — drag anytime while open.
 */
export function SpringSheet({
  open,
  onClose,
  children,
  label,
  labelledBy,
  className = '',
  maxWidthClass = 'max-w-3xl',
}: SpringSheetProps) {
  const reduce = useReducedMotion()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleDragEnd(_: unknown, info: PanInfo) {
    const h = panelRef.current?.offsetHeight ?? 480
    const projected = info.offset.y + project(info.velocity.y)
    const shouldClose =
      projected > h * 0.22 || info.velocity.y > 700 || info.offset.y > h * 0.28
    if (shouldClose) {
      closeRef.current()
    }
  }

  function onScrimKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[var(--z-sheet)] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 z-[var(--z-sheet-backdrop)] bg-[var(--overlay)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? fadeQuick : springUi}
            onClick={onClose}
            onKeyDown={onScrimKeyDown}
            role="button"
            tabIndex={0}
            aria-label="閉じる"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            aria-labelledby={labelledBy}
            className={`material material-sheet relative z-[var(--z-sheet)] flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)] ${maxWidthClass} ${className}`}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, y: 48, scale: 0.99 }
            }
            transition={reduce ? fadeQuick : springMomentum}
            drag={reduce ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.06, bottom: 0.45 }}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ touchAction: 'none' }}
          >
            <div
              className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-[var(--border-strong)]"
              aria-hidden
            />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
