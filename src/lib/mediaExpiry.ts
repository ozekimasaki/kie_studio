const COMPACT_UTC_RE =
  /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/

export function parseSignedUrlTimestamp(value: string): number | undefined {
  const compact = COMPACT_UTC_RE.exec(value)
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4]}:${compact[5]}:${compact[6]}Z`
    const parsed = Date.parse(iso)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function isLocalMediaSrc(src: string): boolean {
  return (
    src.startsWith('/') ||
    src.startsWith('http://127.0.0.1') ||
    src.startsWith('http://localhost') ||
    src.startsWith('blob:') ||
    src.startsWith('data:')
  )
}

/** kie / TOS / S3 などの一時 URL。失敗時に `/api/download-url` で取り直してよい。 */
export function isRefreshableRemoteUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (
      parsed.searchParams.has('X-Tos-Signature') ||
      parsed.searchParams.has('X-Amz-Signature') ||
      parsed.searchParams.has('X-Goog-Signature')
    ) {
      return true
    }
    return /(?:tos-|volces\.com|amazonaws\.com|aliyuncs\.com|byteimg\.com)/i.test(
      parsed.hostname,
    )
  } catch {
    return false
  }
}

export function isExpiredSignedUrl(url: string, now = Date.now()): boolean {
  try {
    const parsed = new URL(url)
    const pairs: Array<[string | null, string | null]> = [
      [parsed.searchParams.get('X-Tos-Date'), parsed.searchParams.get('X-Tos-Expires')],
      [parsed.searchParams.get('X-Amz-Date'), parsed.searchParams.get('X-Amz-Expires')],
    ]
    for (const [date, expires] of pairs) {
      if (!date || !expires) continue
      const start = parseSignedUrlTimestamp(date)
      const ttlSec = Number(expires)
      if (start == null || !Number.isFinite(ttlSec)) continue
      return now > start + ttlSec * 1000
    }
  } catch {
    // ignore invalid URLs
  }
  return false
}
