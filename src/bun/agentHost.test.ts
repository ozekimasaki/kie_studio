// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { AGENT_UNAVAILABLE_TYPE } from '../lib/agentUnavailable.ts'
import { proxyAgentsToSidecar } from './agentHost.ts'

describe('proxyAgentsToSidecar', () => {
  it('returns a Flue error envelope on connection failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('Unable to connect. Is the computer able to access the url?')
    })
    const res = await proxyAgentsToSidecar(
      new Request('http://127.0.0.1:8787/agents/studio/conv-1', {
        method: 'POST',
        body: JSON.stringify({ kind: 'user', body: 'hi' }),
      }),
      { retryDelaysMs: [], fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(res.status).toBe(502)
    const json = (await res.json()) as {
      error: { type: string; message: string; details: string }
    }
    expect(json.error.type).toBe(AGENT_UNAVAILABLE_TYPE)
    expect(json.error.message).toContain('エージェントサーバーに接続できません')
    expect(json.error.details).toContain('8789')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries then succeeds when the sidecar binds late', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ submissionId: 'sub-1' }), { status: 202 }))
    const res = await proxyAgentsToSidecar(
      new Request('http://127.0.0.1:8787/agents/health'),
      { retryDelaysMs: [0], fetchImpl: fetchImpl as unknown as typeof fetch },
    )
    expect(res.status).toBe(202)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
