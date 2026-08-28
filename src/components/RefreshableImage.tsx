import type { ReactNode } from 'react'
import { useRefreshableMediaSrc } from '../lib/useRefreshableMediaSrc.ts'

export function RefreshableImage({
  src,
  alt,
  className,
  loading,
  fallback,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
  fallback: ReactNode
}) {
  const { displaySrc, failed, onError } = useRefreshableMediaSrc(src)
  if (failed) return fallback
  if (!displaySrc) {
    return <div className={className} aria-hidden />
  }
  return (
    <img
      src={displaySrc}
      alt={alt}
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={onError}
    />
  )
}
