import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { fadeQuick, springUi } from '../../lib/motion.ts'

type SharedMediaProps = {
  layoutId: string
  children: ReactNode
  className?: string
}

/** Spatial continuity between gallery thumb and result sheet media. */
export function SharedMedia({
  layoutId,
  children,
  className = '',
}: SharedMediaProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      transition={springUi}
      style={{ borderRadius: 'inherit' }}
    >
      {children}
    </motion.div>
  )
}

export function SharedPresence({
  children,
}: {
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduce ? fadeQuick : springUi}
    >
      {children}
    </motion.div>
  )
}
