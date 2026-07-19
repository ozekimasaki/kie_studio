/** kie.ai retention for generated media files (official: 14 days). */
export const MEDIA_RETENTION_MS = 14 * 24 * 60 * 60 * 1000

/** Remaining days above this count as `ok`; 1–3 as `soon`. */
const SOON_DAYS = 3

export type MediaExpiryStatus = 'ok' | 'soon' | 'expired'

export interface MediaExpiry {
  expiresAt: number
  remainingMs: number
  /** Whole days left (ceil). 0 or negative means expired. */
  daysLeft: number
  status: MediaExpiryStatus
}

export function mediaExpiry(
  createdAt: number,
  now: number = Date.now(),
): MediaExpiry {
  const expiresAt = createdAt + MEDIA_RETENTION_MS
  const remainingMs = expiresAt - now
  const daysLeft = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))

  let status: MediaExpiryStatus
  if (daysLeft <= 0) {
    status = 'expired'
  } else if (daysLeft <= SOON_DAYS) {
    status = 'soon'
  } else {
    status = 'ok'
  }

  return { expiresAt, remainingMs, daysLeft, status }
}

/** Calculate from an API-provided deadline. Prefer this over inferred retention. */
export function mediaExpiryAt(
  expiresAt: number,
  now: number = Date.now(),
): MediaExpiry {
  const normalized = expiresAt < 1e12 ? expiresAt * 1000 : expiresAt
  const remainingMs = normalized - now
  const daysLeft = Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
  return {
    expiresAt: normalized,
    remainingMs,
    daysLeft,
    status: daysLeft <= 0 ? 'expired' : daysLeft <= SOON_DAYS ? 'soon' : 'ok',
  }
}

/** Short label for gallery cards. */
export function mediaExpiryCardLabel(expiry: MediaExpiry): string {
  switch (expiry.status) {
    case 'expired':
      return '期限切れの可能性'
    case 'soon':
      return `あと${expiry.daysLeft}日`
    case 'ok':
      return `残${expiry.daysLeft}日`
    default: {
      const _exhaustive: never = expiry.status
      return _exhaustive
    }
  }
}

/** Longer label for the detail viewer. */
export function mediaExpiryViewerLabel(expiry: MediaExpiry): string {
  switch (expiry.status) {
    case 'expired':
      return 'kie.ai 側の保管期限を過ぎている可能性があります。早めに Download via API で保存してください'
    case 'soon':
      return `kie.ai 側の保管期限: あと ${expiry.daysLeft} 日 — 早めに Download via API で保存してください`
    case 'ok':
      return `kie.ai 側の保管期限: あと ${expiry.daysLeft} 日（要ダウンロード）`
    default: {
      const _exhaustive: never = expiry.status
      return _exhaustive
    }
  }
}
