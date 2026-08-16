// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { extractAsarPrefix, parseElectrobunAsar } from './agentAsar.ts'

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

describe('parseElectrobunAsar', () => {
  it('reads the uint64 JSON header used by zig-asar', () => {
    const buf = buildElectrobunAsar({ 'app.mjs': 'export const ok = 1\n' })
    const { tree, dataStart } = parseElectrobunAsar(buf)
    expect(dataStart).toBe(8 + Number(buf.readBigUInt64LE(0)))
    const file = (tree.files['agent-server'] as { files: Record<string, { size: number }> }).files[
      'app.mjs'
    ]
    expect(file?.size).toBe('export const ok = 1\n'.length)
  })
})

describe('extractAsarPrefix', () => {
  it('writes the prefix onto disk and skips source maps', () => {
    const buf = buildElectrobunAsar({
      'app.mjs': 'export { loadFlueNodeApplication }\n',
      'app.mjs.map': '{"version":3}\n',
      'chunk.mjs': 'export const chunk = true\n',
    })
    const dest = mkdtempSync(join(tmpdir(), 'asar-extract-'))
    temps.push(dest)
    const written = extractAsarPrefix(buf, 'agent-server', dest)
    expect(written.some((path) => path.endsWith('app.mjs'))).toBe(true)
    expect(written.some((path) => path.endsWith('.map'))).toBe(false)
    expect(readFileSync(join(dest, 'app.mjs'), 'utf8')).toContain('loadFlueNodeApplication')
    expect(readFileSync(join(dest, 'chunk.mjs'), 'utf8')).toContain('chunk')
  })
})
