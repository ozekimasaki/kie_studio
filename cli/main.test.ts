// @vitest-environment node
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  discoverApiBase,
  StudioClient,
} from './client.ts'
import { main, parseSetPair, resolveCatalogModel, type CliIo } from './main.ts'
import type { CatalogModel } from './client.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeIo(fetchImpl: typeof fetch, extra: Partial<CliIo> = {}): CliIo {
  const stdout: string[] = []
  const stderr: string[] = []
  return {
    stdout: (text) => {
      stdout.push(text)
    },
    stderr: (text) => {
      stderr.push(text)
    },
    fetch: fetchImpl,
    env: {},
    spawnServer: async () => 0,
    openUrl: async () => true,
    sleep: async () => undefined,
    now: () => 0,
    repoRoot: '/tmp',
    ...extra,
  }
}

describe('discoverApiBase', () => {
  it('returns the first healthy port in 8787-8806', async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === 'http://127.0.0.1:8788/api/health') {
        return jsonResponse({ ok: true })
      }
      return jsonResponse({ ok: false }, 503)
    }) as unknown as typeof fetch
    await expect(discoverApiBase({ fetchImpl })).resolves.toBe(
      'http://127.0.0.1:8788',
    )
  })

  it('uses STUDIO_API_BASE when it is healthy', async () => {
    const fetchImpl = vi.fn(async (input: string) => {
      if (input === 'http://127.0.0.1:9999/api/health') {
        return jsonResponse({ ok: true })
      }
      return jsonResponse({ ok: false }, 503)
    }) as unknown as typeof fetch
    await expect(
      discoverApiBase({ envBase: 'http://127.0.0.1:9999', fetchImpl }),
    ).resolves.toBe('http://127.0.0.1:9999')
  })
})

describe('resolveCatalogModel', () => {
  const models: CatalogModel[] = [
    {
      id: 'market/flux-kontext-pro',
      model: 'flux-kontext-pro',
      title: 'FLUX Kontext Pro',
      category: 'image',
      provider: 'market',
      operation: 'generate',
    },
    {
      id: 'market/other',
      model: 'other',
      title: 'Other',
      category: 'image',
      provider: 'market',
      operation: 'generate',
    },
  ]

  it('resolves by id or unique substring', () => {
    expect(resolveCatalogModel(models, 'market/flux-kontext-pro').id).toBe(
      'market/flux-kontext-pro',
    )
    expect(resolveCatalogModel(models, 'flux-kontext-pro').id).toBe(
      'market/flux-kontext-pro',
    )
  })
})

describe('parseSetPair', () => {
  it('parses JSON values and falls back to strings', () => {
    expect(parseSetPair('n=1')).toEqual(['n', 1])
    expect(parseSetPair('ok=true')).toEqual(['ok', true])
    expect(parseSetPair('aspect_ratio=16:9')).toEqual(['aspect_ratio', '16:9'])
  })
})

describe('main', () => {
  it('prints root help', async () => {
    const lines: string[] = []
    const io = makeIo(fetch, {
      stdout: (text) => {
        lines.push(text)
      },
    })
    await expect(main(['--help'], io)).resolves.toBe(0)
    expect(lines.join('\n')).toContain('kiestudio generate')
  })

  it('prints generate help with examples', async () => {
    const lines: string[] = []
    const io = makeIo(fetch, {
      stdout: (text) => {
        lines.push(text)
      },
    })
    await expect(main(['generate', '--help'], io)).resolves.toBe(0)
    expect(lines.join('\n')).toContain('kiestudio generate -m flux-kontext-pro')
  })

  it('fails with a hint when the API is down', async () => {
    const stderr: string[] = []
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: false }, 503)) as unknown as typeof fetch
    const io = makeIo(fetchImpl, {
      stderr: (text) => {
        stderr.push(text)
      },
    })
    await expect(main(['models'], io)).resolves.toBe(1)
    expect(stderr.join('\n')).toContain('kiestudio up')
  })

  it('lists models from the catalog', async () => {
    const stdout: string[] = []
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.includes('/api/models')) {
        return jsonResponse({
          models: [
            {
              id: 'market/flux-kontext-pro',
              model: 'flux-kontext-pro',
              title: 'FLUX Kontext Pro',
              category: 'image',
              provider: 'market',
              operation: 'generate',
            },
          ],
        })
      }
      return jsonResponse({ error: `unexpected ${url} ${init?.method}` }, 500)
    }) as unknown as typeof fetch
    const io = makeIo(fetchImpl, {
      stdout: (text) => {
        stdout.push(text)
      },
    })
    await expect(main(['models', 'flux'], io)).resolves.toBe(0)
    expect(stdout.join('\n')).toContain('market/flux-kontext-pro')
  })

  it('creates a generate task', async () => {
    const stdout: string[] = []
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.includes('/api/models')) {
        return jsonResponse({
          models: [
            {
              id: 'market/flux-kontext-pro',
              model: 'flux-kontext-pro',
              title: 'FLUX Kontext Pro',
              category: 'image',
              provider: 'market',
              operation: 'generate',
              fields: [{ name: 'prompt', required: true }],
            },
          ],
        })
      }
      if (url.endsWith('/api/generate') && init?.method === 'POST') {
        return jsonResponse({ taskId: 'task-1' })
      }
      return jsonResponse({ error: `unexpected ${url}` }, 500)
    }) as unknown as typeof fetch
    const io = makeIo(fetchImpl, {
      stdout: (text) => {
        stdout.push(text)
      },
    })
    await expect(
      main(['generate', '-m', 'flux-kontext-pro', '-p', 'a cat', '--json'], io),
    ).resolves.toBe(0)
    expect(stdout.join('\n')).toContain('task-1')
    const generateCall = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => String(call[0]).endsWith('/api/generate'),
    )
    expect(generateCall).toBeDefined()
    const body = JSON.parse(String((generateCall?.[1] as RequestInit).body)) as {
      model: string
      input: { prompt: string }
      workflowId: string
    }
    expect(body.model).toBe('flux-kontext-pro')
    expect(body.input.prompt).toBe('a cat')
    expect(body.workflowId).toBe('market/flux-kontext-pro')
  })

  it('reports missing required fields', async () => {
    const stderr: string[] = []
    const fetchImpl = vi.fn(async (input: string) => {
      const url = String(input)
      if (url.endsWith('/api/health')) return jsonResponse({ ok: true })
      if (url.includes('/api/models')) {
        return jsonResponse({
          models: [
            {
              id: 'market/flux-kontext-pro',
              model: 'flux-kontext-pro',
              title: 'FLUX Kontext Pro',
              category: 'image',
              provider: 'market',
              operation: 'generate',
              fields: [{ name: 'prompt', required: true }],
            },
          ],
        })
      }
      return jsonResponse({ error: 'unexpected' }, 500)
    }) as unknown as typeof fetch
    const io = makeIo(fetchImpl, {
      stderr: (text) => {
        stderr.push(text)
      },
    })
    await expect(main(['generate', '-m', 'flux-kontext-pro'], io)).resolves.toBe(1)
    expect(stderr.join('\n')).toContain('prompt')
  })
})

describe('StudioClient', () => {
  it('surfaces API error messages', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: 'model is required' }, 400),
    ) as unknown as typeof fetch
    const client = new StudioClient('http://127.0.0.1:8787', fetchImpl)
    await expect(
      client.generate({
        model: '',
        input: {},
        provider: 'market',
        operation: 'generate',
      }),
    ).rejects.toThrow('model is required')
  })
})
