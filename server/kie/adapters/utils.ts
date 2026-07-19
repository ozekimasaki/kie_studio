import type { MediaAsset, MediaKind } from '../types.ts'

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function urlsFrom(value: unknown): string[] {
  if (typeof value === 'string') return value ? [value] : []
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function mediaFromUrls(urls: string[], kind: MediaKind): MediaAsset[] {
  return urls.map((url) => ({ kind, url }))
}

export function uniqueUrls(media: MediaAsset[]): string[] {
  return [...new Set(media.flatMap((asset) => {
    const value = asset.url ?? asset.streamUrl
    return value ? [value] : []
  }))]
}

export function normalizeEpoch(value: unknown): number | undefined {
  const number = asNumber(value)
  if (number === undefined) return undefined
  return number < 1e12 ? number * 1000 : number
}
