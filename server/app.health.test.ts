// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('GET /api/health', () => {
  it('includes the package.json version', async () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      version: string
    }
    const app = createApp()
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      ok: boolean
      version: string
      hasKey: boolean
      isDesktop: boolean
    }
    expect(json.ok).toBe(true)
    expect(json.version).toBe(pkg.version)
    expect(typeof json.hasKey).toBe('boolean')
    expect(typeof json.isDesktop).toBe('boolean')
  })
})
