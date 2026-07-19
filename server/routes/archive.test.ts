// @vitest-environment node
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDownloadUrl = vi.fn(async (url: string) => url)

vi.mock('../kie/common.ts', () => ({ getDownloadUrl }))

describe('POST /archive', () => {
  beforeEach(() => {
    getDownloadUrl.mockImplementation(async (url: string) => url)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('media bytes', {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
    })))
  })

  it('streams selected media and lyrics as a ZIP', async () => {
    const { archiveRoutes } = await import('./archive.ts')
    const app = new Hono().route('/', archiveRoutes)
    const response = await app.request('/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          url: 'https://cdn.example.com/song.mp3',
          name: 'song',
          lyrics: 'hello world',
        }],
      }),
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/zip')
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    expect(bytes.length).toBeGreaterThan(50)
  })

  it('keeps the ZIP valid when one temporary URL has expired', async () => {
    getDownloadUrl.mockRejectedValueOnce(new Error('expired'))
    const { archiveRoutes } = await import('./archive.ts')
    const app = new Hono().route('/', archiveRoutes)
    const response = await app.request('/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{
        url: 'https://cdn.example.com/expired.mp4',
        name: 'expired.mp4',
        lyrics: 'cached synchronized lyrics',
      }] }),
    })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const archiveText = new TextDecoder().decode(bytes)
    expect(response.status).toBe(200)
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    expect(archiveText).toContain('expired-lyrics.txt')
    expect(archiveText).toContain('expired.mp4.error.txt')
  })
})
