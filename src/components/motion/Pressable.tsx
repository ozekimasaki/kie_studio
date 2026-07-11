import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
} from 'motion/react'
import { forwardRef, type ReactNode } from 'react'
import { springSnappy } from '../../lib/motion.ts'

type PressableProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  children?: ReactNode
  scaleTo?: number
}

/** Instant press feedback on pointer-down; spring settle on release. */
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(
  function Pressable(
    { children, scaleTo = 0.96, disabled, className, style, ...rest },
    ref,
  ) {
    const reduce = useReducedMotion()

    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        className={className}
        style={{ touchAction: 'manipulation', ...style }}
        whileTap={
          disabled || reduce
            ? undefined
            : { scale: scaleTo, transition: { duration: 0.06 } }
        }
        transition={reduce ? { duration: 0 } : springSnappy}
        {...rest}
      >
        {children}
      </motion.button>
    )
  },
)

type PressableDivProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: ReactNode
  scaleTo?: number
}

export function PressableDiv({
  children,
  scaleTo = 0.96,
  className,
  style,
  ...rest
}: PressableDivProps) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      style={{ touchAction: 'manipulation', ...style }}
      whileTap={
        reduce ? undefined : { scale: scaleTo, transition: { duration: 0.06 } }
      }
      transition={reduce ? { duration: 0 } : springSnappy}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
