// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STUDIO_APP_IDENTIFIER, ensureInstallWorkingDirectory, knownInstallBinDirs } from './installCwd.ts'

const temps: string[] = []

afterEach(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true })
  temps.length = 0
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
    writeFileSync(
      join(bin, '../Resources/version.json'),
      '{"identifier":"ai.kie.studio","channel":"canary"}\n',
    )
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
