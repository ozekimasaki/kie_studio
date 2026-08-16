/**
 * keep-agent-server.mjs
 *
 * Electrobun `postBuild` hook (runs BEFORE asar pack). Copies
 * `Resources/app/agent-server` to `Resources/agent-server` so the embed
 * survives `rmSync(Resources/app)` after packing.
 *
 * Electrobun's `asarUnpack` is a no-op for this: zig-asar `--unpack` plus
 * deleting the whole `app/` folder leaves no `app.asar.unpacked`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const buildDir = process.env.ELECTROBUN_BUILD_DIR

function walkDirs(dir, depth, visit) {
  if (depth > 8 || !existsSync(dir)) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  visit(dir)
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    walkDirs(join(dir, entry.name), depth + 1, visit)
  }
}

function findPackedAgentServer(root) {
  /** @type {string[]} */
  const found = []
  walkDirs(root, 0, (dir) => {
    if (basename(dir) !== 'agent-server') return
    if (basename(dirname(dir)) !== 'app') return
    if (!existsSync(join(dir, 'app.mjs'))) return
    found.push(dir)
  })
  return found.find((path) => path.replaceAll('\\', '/').includes('/Resources/app/agent-server')) ?? found[0] ?? null
}

function copySkipMaps(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name.endsWith('.map')) continue
    const from = join(src, entry.name)
    const to = join(dest, entry.name)
    if (entry.isDirectory()) copySkipMaps(from, to)
    else cpSync(from, to)
  }
}

if (!buildDir || !existsSync(buildDir)) {
  console.warn('[keep-agent-server] ELECTROBUN_BUILD_DIR が無いためスキップ')
  process.exit(0)
}

const src = findPackedAgentServer(buildDir)
if (!src) {
  console.warn(
    '[keep-agent-server] Resources/app/agent-server/app.mjs が見つかりません（npm run agent:build 済みか確認）',
  )
  process.exit(0)
}

const dest = join(dirname(dirname(src)), 'agent-server')
if (dest === src) {
  console.log(`[keep-agent-server] 既に Resources 直下です: ${dest}`)
  process.exit(0)
}

copySkipMaps(src, dest)
if (!existsSync(join(dest, 'app.mjs'))) {
  console.error(`[keep-agent-server] コピー後に app.mjs がありません: ${dest}`)
  process.exit(1)
}
console.log(`[keep-agent-server] ${src} -> ${dest}`)
