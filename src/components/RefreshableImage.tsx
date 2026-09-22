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

export function RefreshableVideo({
  src,
  className,
  controls = true,
  muted,
  preload = 'metadata',
  fallback,
}: {
  src: string
  className?: string
  controls?: boolean
  muted?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  fallback?: ReactNode
}) {
  const { displaySrc, failed, onError } = useRefreshableMediaSrc(src)
  if (failed) {
    return (
      fallback ?? (
        <div className={`flex items-center justify-center bg-black text-xs text-[var(--text-muted)] ${className ?? ''}`}>
          メディアを取得できません
        </div>
      )
    )
  }
  if (!displaySrc) return <div className={className} aria-hidden />
  return (
    <video
      src={displaySrc}
      controls={controls}
      muted={muted}
      preload={preload}
      className={className}
      onError={onError}
    />
  )
}

export function RefreshableAudio({
  src,
  className,
  fallback,
}: {
  src: string
  className?: string
  fallback?: ReactNode
}) {
  const { displaySrc, failed, onError } = useRefreshableMediaSrc(src)
  if (failed) {
    return (
      fallback ?? (
        <p className="text-xs text-[var(--text-muted)]">メディアを取得できません</p>
      )
    )
  }
  if (!displaySrc) return null
  return <audio src={displaySrc} controls className={className} onError={onError} />
}
