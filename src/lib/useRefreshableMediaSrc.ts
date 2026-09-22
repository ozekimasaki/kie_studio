import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchDownloadUrl } from './api.ts'
import {
  isExpiredSignedUrl,
  isLocalMediaSrc,
  isRefreshableRemoteUrl,
} from './mediaExpiry.ts'

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

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
  const srcRef = useRef(src)
  const abortRef = useRef<AbortController | null>(null)
  srcRef.current = src

  const refresh = useCallback((requested: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    retried.current = true
    void fetchDownloadUrl(requested, { signal: controller.signal })
      .then((res) => {
        if (srcRef.current !== requested) return
        const next = res.data.downloadUrl
        if (next) {
          setDisplaySrc(next)
          setFailed(false)
        } else {
          setFailed(true)
        }
      })
      .catch((error) => {
        if (isAbortError(error) || srcRef.current !== requested) return
        setFailed(true)
      })
  }, [])

  useEffect(() => {
    retried.current = false
    setFailed(false)
    if (!src) {
      setDisplaySrc(undefined)
      return () => abortRef.current?.abort()
    }
    if (!isExpiredSignedUrl(src)) {
      setDisplaySrc(src)
      return () => abortRef.current?.abort()
    }
    setDisplaySrc(undefined)
    if (!isRefreshableRemoteUrl(src)) {
      setFailed(true)
      return () => abortRef.current?.abort()
    }
    refresh(src)
    return () => abortRef.current?.abort()
  }, [refresh, src])

  const onError = useCallback(() => {
    const requested = srcRef.current
    if (
      !requested ||
      retried.current ||
      isLocalMediaSrc(requested) ||
      !isRefreshableRemoteUrl(requested)
    ) {
      setFailed(true)
      return
    }
    refresh(requested)
  }, [refresh])

  return { displaySrc, failed, onError }
}
