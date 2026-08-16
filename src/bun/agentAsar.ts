import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, posix } from 'node:path'

type AsarFile = { size: number; offset: string | number }
type AsarDir = { files: Record<string, AsarNode> }
type AsarNode = AsarFile | AsarDir

function isDir(node: AsarNode): node is AsarDir {
  return 'files' in node
}

/** Electrobun zig-asar: uint64 LE JSON length, JSON at offset 8, then file data. */
export function parseElectrobunAsar(buf: Buffer): { tree: AsarDir; dataStart: number } {
  if (buf.length < 16 || buf[8] !== 0x7b) {
    throw new Error('invalid asar header')
  }
  const jsonLength = Number(buf.readBigUInt64LE(0))
  if (!Number.isFinite(jsonLength) || jsonLength < 2 || 8 + jsonLength > buf.length) {
    throw new Error('invalid asar json length')
  }
  const json = buf.subarray(8, 8 + jsonLength).toString('utf8')
  const tree = JSON.parse(json) as AsarDir
  if (!tree || typeof tree !== 'object' || !tree.files) {
    throw new Error('invalid asar directory tree')
  }
  return { tree, dataStart: 8 + jsonLength }
}

function walkPrefix(
  node: AsarDir,
  rel: string,
  out: { rel: string; file: AsarFile }[],
): void {
  for (const [name, child] of Object.entries(node.files)) {
    const nextRel = rel ? posix.join(rel, name) : name
    if (isDir(child)) {
      walkPrefix(child, nextRel, out)
    } else {
      out.push({ rel: nextRel, file: child })
    }
  }
}

function dirAt(tree: AsarDir, prefix: string): AsarDir | null {
  const parts = prefix.split('/').filter(Boolean)
  let node: AsarDir = tree
  for (const part of parts) {
    const child = node.files[part]
    if (!child || !isDir(child)) return null
    node = child
  }
  return node
}

export type ExtractAsarPrefixOptions = {
  skipSuffixes?: string[]
}

/**
 * Extract one directory prefix from an Electrobun `app.asar` onto disk.
 * Used when `asarUnpack` is ignored (Electrobun deletes `Resources/app` after pack).
 */
export function extractAsarPrefix(
  buf: Buffer,
  prefix: string,
  destDir: string,
  options: ExtractAsarPrefixOptions = {},
): string[] {
  const skipSuffixes = options.skipSuffixes ?? ['.map']
  const { tree, dataStart } = parseElectrobunAsar(buf)
  const dir = dirAt(tree, prefix)
  if (!dir) throw new Error(`asar prefix not found: ${prefix}`)
  const files: { rel: string; file: AsarFile }[] = []
  walkPrefix(dir, '', files)
  const written: string[] = []
  for (const entry of files) {
    if (skipSuffixes.some((suffix) => entry.rel.endsWith(suffix))) continue
    const offset = Number(entry.file.offset)
    const size = entry.file.size
    if (!Number.isFinite(offset) || !Number.isFinite(size) || size < 0) {
      throw new Error(`invalid asar file entry: ${entry.rel}`)
    }
    const start = dataStart + offset
    const slice = buf.subarray(start, start + size)
    if (slice.length !== size) throw new Error(`truncated asar file: ${entry.rel}`)
    const dest = join(destDir, ...entry.rel.split('/'))
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, slice)
    written.push(dest)
  }
  return written
}
