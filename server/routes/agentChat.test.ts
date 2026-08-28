// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'

process.env.STUDIO_DB_PATH = join(mkdtempSync(join(tmpdir(), 'kie-agent-chat-')), 'studio.db')

const { agentChatRoutes } = await import('./agentChat.ts')
const { upsertAgentConversation, saveAgentMessages } = await import(
  '../db/agentConversations.ts'
)

function makeApp() {
  return new Hono().route('/api', agentChatRoutes)
}

describe('agent chat routes', () => {
  it('GET /api/agent/health is always ok when Hono is up', async () => {
    const res = await makeApp().request('/api/agent/health')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('POST /api/agent/chat rejects an invalid agentRunMode', async () => {
    const res = await makeApp().request('/api/agent/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-1',
        provider: 'xai',
        model: 'grok-4.5',
        agentRunMode: 'hack',
        messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /api/agent/chat returns 400 without a usable LLM key', async () => {
    const res = await makeApp().request('/api/agent/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv-1',
        provider: 'xai',
        model: 'grok-4.5',
        messages: [
          { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
        ],
      }),
    })
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error).toMatch(/API キー/)
  })

  it('GET messages for an unknown conversation is an empty list', async () => {
    const res = await makeApp().request('/api/agent-conversations/missing/messages')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { messages: [] } })
  })

  it('roundtrips saved conversation messages', async () => {
    upsertAgentConversation({
      id: 'conv-saved',
      title: '保存済み',
      provider: 'xai',
      model: 'grok-4.5',
    })
    const stored = [
      { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
    ]
    saveAgentMessages('conv-saved', stored)
    const res = await makeApp().request('/api/agent-conversations/conv-saved/messages')
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ data: { messages: stored } })
  })
})
