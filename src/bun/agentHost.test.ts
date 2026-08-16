// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENT_UNAVAILABLE_MESSAGE, AGENT_UNAVAILABLE_TYPE } from '../lib/agentUnavailable.ts'
import {
  agentAppCandidates,
  ensureInstallWorkingDirectory,
  extractEmbeddedAgentFromAsar,
  knownInstallBinDirs,
  packagedAgentAppPaths,
  proxyAgentsToSidecar,
  resolveAgentAppPath,
  STUDIO_APP_IDENTIFIER,
} from './agentHost.ts'

function buildElectrobunAsar(files: Record<string, string>): Buffer {
  const inner: Record<string, { size: number; offset: string }> = {}
  const blobs: Buffer[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const buf = Buffer.from(content, 'utf8')
    inner[name] = { size: buf.length, offset: String(offset) }
    blobs.push(buf)
    offset += buf.length
  }
  const json = Buffer.from(
    JSON.stringify({ files: { 'agent-server': { files: inner } } }),
    'utf8',
  )
  const header = Buffer.alloc(8)
  header.writeBigUInt64LE(BigInt(json.length), 0)
  return Buffer.concat([header, json, ...blobs])
}

const temps: string[] = []

afterEach(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
  temps.length = 0
})

describe('resolveAgentAppPath', () => {
  it('prefers Resources/agent-server next to the launcher bin', () => {
    const bin = '/fake/app/bin'
    const candidates = agentAppCandidates([bin])
    expect(candidates).toContain(join(bin, '../Resources/agent-server/app.mjs'))
    const found = resolveAgentAppPath(
      (path) => path === join(bin, '../Resources/agent-server/app.mjs'),
      [bin],
    )
    expect(found).toBe(join(bin, '../Resources/agent-server/app.mjs'))
  })
})

describe('extractEmbeddedAgentFromAsar', () => {
  it('extracts app.mjs from a packed agent-server prefix', () => {
    const dest = mkdtempSync(join(tmpdir(), 'agent-asar-'))
    temps.push(dest)
    const asar = buildElectrobunAsar({ 'app.mjs': 'export const loadFlueNodeApplication = 1\n' })
    const appPath = extractEmbeddedAgentFromAsar('/unused.asar', dest, () => asar)
    expect(appPath).toBe(join(dest, 'app.mjs'))
    expect(readFileSync(appPath, 'utf8')).toContain('loadFlueNodeApplication')
  })
})

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
      { retryDelaysMs: [], fetchImpl: fetchImpl as unknown as typeof fetch, packaged: false },
    )
    expect(res.status).toBe(502)
    const json = (await res.json()) as {
      error: { type: string; message: string; details: string }
    }
    expect(json.error.type).toBe(AGENT_UNAVAILABLE_TYPE)
    expect(json.error.message).toContain(AGENT_UNAVAILABLE_MESSAGE)
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
      { retryDelaysMs: [0], fetchImpl: fetchImpl as unknown as typeof fetch, packaged: false },
    )
    expect(res.status).toBe(202)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not call the sidecar on a packaged install without embed', async () => {
    const fetchImpl = vi.fn()
    const res = await proxyAgentsToSidecar(
      new Request('http://127.0.0.1:8787/agents/studio/conv-1', { method: 'POST', body: '{}' }),
      { fetchImpl: fetchImpl as unknown as typeof fetch, packaged: true },
    )
    expect(res.status).toBe(502)
    expect(fetchImpl).not.toHaveBeenCalled()
    const json = (await res.json()) as { error: { message: string; details: string } }
    expect(json.error.message).toBe(AGENT_UNAVAILABLE_MESSAGE)
    expect(json.error.details).toContain('asarUnpack')
  })

  it('uses the load-error details on a packaged 502', async () => {
    const res = await proxyAgentsToSidecar(
      new Request('http://127.0.0.1:8787/agents/health'),
      { packaged: true, details: 'failed to load embedded Flue from C:\\app\\Resources\\agent-server\\app.mjs: boom' },
    )
    expect(res.status).toBe(502)
    const json = (await res.json()) as { error: { details: string } }
    expect(json.error.details).toContain('boom')
  })
})

describe('knownInstallBinDirs', () => {
  it('points at the Windows per-user Electrobun layout', () => {
    const bins = knownInstallBinDirs(
      { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' },
      'C:\\Users\\me\\AppData\\Local\\ai.kie.studio\\canary',
    )
    expect(bins).toContain(
      join('C:\\Users\\me\\AppData\\Local', STUDIO_APP_IDENTIFIER, 'canary', 'app', 'bin'),
    )
    expect(bins).toContain(join('C:\\Users\\me\\AppData\\Local\\ai.kie.studio\\canary', 'app', 'bin'))
  })
})

describe('packagedAgentAppPaths', () => {
  it('finds Resources/agent-server when cwd is Temp and LOCALAPPDATA has the install', () => {
    const local = mkdtempSync(join(tmpdir(), 'kie-localapp-'))
    temps.push(local)
    const bin = join(local, STUDIO_APP_IDENTIFIER, 'canary', 'app', 'bin')
    const appMjs = join(bin, '../Resources/agent-server/app.mjs')
    mkdirSync(join(bin, '../Resources/agent-server'), { recursive: true })
    writeFileSync(appMjs, 'export const loadFlueNodeApplication = 1\n')
    const tempRoot = mkdtempSync(join(tmpdir(), 'kie-temp-'))
    temps.push(tempRoot)
    const paths = packagedAgentAppPaths([tempRoot], { LOCALAPPDATA: local })
    expect(paths).toContain(appMjs)
    const found = resolveAgentAppPath(existsSync, [tempRoot], paths)
    expect(found).toBe(appMjs)
  })
})

describe('ensureInstallWorkingDirectory', () => {
  it('does not chdir from a repo checkout', () => {
    const repo = mkdtempSync(join(tmpdir(), 'kie-repo-'))
    temps.push(repo)
    writeFileSync(join(repo, 'electrobun.config.ts'), 'export default {}\n')
    const chdir = vi.fn()
    expect(
      ensureInstallWorkingDirectory({
        cwd: () => repo,
        chdir,
        env: { LOCALAPPDATA: join(repo, 'no-install') },
      }),
    ).toBe(repo)
    expect(chdir).not.toHaveBeenCalled()
  })

  it('chdirs from a temp Worker cwd to the Windows install bin', () => {
    const local = mkdtempSync(join(tmpdir(), 'kie-local-'))
    temps.push(local)
    const bin = join(local, STUDIO_APP_IDENTIFIER, 'canary', 'app', 'bin')
    mkdirSync(join(bin, '../Resources'), { recursive: true })
    mkdirSync(bin, { recursive: true })
    writeFileSync(join(bin, '../Resources/version.json'), '{"identifier":"ai.kie.studio","channel":"canary"}\n')
    const tempCwd = mkdtempSync(join(tmpdir(), 'kie-worker-'))
    temps.push(tempCwd)
    const chdir = vi.fn()
    expect(
      ensureInstallWorkingDirectory({
        cwd: () => tempCwd,
        chdir,
        env: { LOCALAPPDATA: local },
      }),
    ).toBe(bin)
    expect(chdir).toHaveBeenCalledWith(bin)
  })
})
