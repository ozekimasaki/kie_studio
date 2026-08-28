import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDownloadUrl } from './api.ts'
import {
  isExpiredSignedUrl,
  isLocalMediaSrc,
  isRefreshableRemoteUrl,
} from './mediaExpiry.ts'

export function useRefreshableMediaSrc(src: string | undefined): {
  displaySrc: string | undefined
  failed: boolean
  onError: () => void
} {
  const [displaySrc, setDisplaySrc] = useState<string | undefined>(() =>
    src && !isExpiredSignedUrl(src) ? src : undefined,
  )
  const [failed, setFailed] = useState(false)
  const retried = useRef(false)

  useEffect(() => {
    retried.current = false
    setFailed(false)
    if (!src) {
      setDisplaySrc(undefined)
      return
    }
    if (!isExpiredSignedUrl(src)) {
      setDisplaySrc(src)
      return
    }
    setDisplaySrc(undefined)
    if (!isRefreshableRemoteUrl(src)) {
      setFailed(true)
      return
    }

    let cancelled = false
    retried.current = true
    void fetchDownloadUrl(src)
      .then((res) => {
        if (cancelled) return
        const next = res.data.downloadUrl
        if (next) setDisplaySrc(next)
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  const onError = useCallback(() => {
    if (!src || retried.current || isLocalMediaSrc(src) || !isRefreshableRemoteUrl(src)) {
      setFailed(true)
      return
    }
    retried.current = true
    void fetchDownloadUrl(src)
      .then((res) => {
        const next = res.data.downloadUrl
        if (next) setDisplaySrc(next)
        else setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [src])

  return { displaySrc, failed, onError }
}
