// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const script = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/keep-agent-server.mjs')
const temps: string[] = []

afterEach(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
  temps.length = 0
})

describe('keep-agent-server.mjs', () => {
  it('copies Resources/app/agent-server to Resources/agent-server without maps', () => {
    const root = mkdtempSync(join(tmpdir(), 'keep-agent-'))
    temps.push(root)
    const packed = join(root, 'KIESTUDIO-canary', 'Resources', 'app', 'agent-server')
    mkdirSync(packed, { recursive: true })
    writeFileSync(join(packed, 'app.mjs'), 'export const ok = true\n')
    writeFileSync(join(packed, 'app.mjs.map'), '{"version":3}\n')
    execFileSync(process.execPath, [script], {
      env: { ...process.env, ELECTROBUN_BUILD_DIR: root },
      stdio: 'pipe',
    })
    const dest = join(root, 'KIESTUDIO-canary', 'Resources', 'agent-server', 'app.mjs')
    expect(readFileSync(dest, 'utf8')).toContain('ok')
    expect(existsSync(join(root, 'KIESTUDIO-canary', 'Resources', 'agent-server', 'app.mjs.map'))).toBe(
      false,
    )
  })
})
