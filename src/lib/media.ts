/** Result URL heuristic shared by gallery display and input routing. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('video')
}

export function isAudioUrl(url: string): boolean {
  const clean = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? ''
  return /\.(mp3|wav|m4a|aac|ogg|flac|opus)$/i.test(clean)
}

export function mediaKindFromUrl(
  url: string,
  fallback: 'image' | 'video' | 'audio' = 'image',
): 'image' | 'video' | 'audio' {
  if (isVideoUrl(url)) return 'video'
  if (isAudioUrl(url)) return 'audio'
  return fallback
}

type MediaIdentity = {
  id?: string
  providerAssetId?: string
  url?: string
  streamUrl?: string
  localPath?: string
}

function identityKeys(asset: MediaIdentity): string[] {
  return [asset.id, asset.providerAssetId, asset.localPath, asset.url, asset.streamUrl].filter(
    (key): key is string => Boolean(key),
  )
}

/** 再構築した media オブジェクト同士でも、同じ実体なら true。 */
export function sameMediaAsset(a: MediaIdentity, b: MediaIdentity): boolean {
  if (a === b) return true
  const bKeys = identityKeys(b)
  return identityKeys(a).some((key) => bKeys.includes(key))
}

/** playlist 内の同一実体を、URL 再取得後のオブジェクトへ差し替える。 */
export function replaceMatchingAsset<T extends MediaIdentity>(
  list: T[],
  target: MediaIdentity,
  next: T,
): T[] {
  return list.map((item) => (sameMediaAsset(item, target) ? next : item))
}
