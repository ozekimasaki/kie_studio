/** Result URL heuristic shared by gallery display and input routing. */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('video')
}
