import { kieFetch } from './client.ts'

interface CreditResponse {
  code: number
  msg: string
  data: number
}

interface DownloadUrlResponse {
  code: number
  msg: string
  data: string
}

export async function getCredits(): Promise<number> {
  const res = await kieFetch<CreditResponse>('/api/v1/chat/credit')
  if (res.code !== 200) throw new Error(res.msg || 'Failed to get credits')
  return res.data
}

export async function getDownloadUrl(url: string): Promise<string> {
  const res = await kieFetch<DownloadUrlResponse>('/api/v1/common/download-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
  if (res.code !== 200 || !res.data) {
    throw new Error(res.msg || 'Failed to get download URL')
  }
  return res.data
}
