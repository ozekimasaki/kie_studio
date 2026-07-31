/**
 * collect-release.mjs
 *
 * Electrobun はビルドのたびに `artifacts/` を削除して再生成するため、
 * Windows をビルドすると Linux の成果物が消え、逆もまた然りです。
 *
 * このスクリプトは各プラットフォームのビルド後に `artifacts/*` を
 * 永続的な `release/` ディレクトリへコピーして集積します。
 * 成果物ファイル名にはプラットフォーム接頭辞（canary-win-x64-* /
 * canary-linux-x64-* 等）が付くため衝突せず、両プラットフォームの
 * 成果物が `release/` に蓄積されます。
 *
 * 使い方（各プラットフォームのビルド後）:
 *   node scripts/collect-release.mjs
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const artifactsDir = join(root, 'artifacts')
const releaseDir = join(root, 'release')

if (!existsSync(artifactsDir)) {
  console.error('[collect-release] artifacts/ が見つかりません。先に electrobun build を実行してください。')
  process.exit(1)
}

const files = readdirSync(artifactsDir).filter((f) => !f.startsWith('.'))
if (files.length === 0) {
  console.error('[collect-release] artifacts/ が空です。')
  process.exit(1)
}

mkdirSync(releaseDir, { recursive: true })
for (const file of files) {
  cpSync(join(artifactsDir, file), join(releaseDir, file), { force: true })
  console.log(`[collect-release] artifacts/${file} -> release/${file}`)
}

const all = readdirSync(releaseDir).filter((f) => !f.startsWith('.'))
console.log(`[collect-release] 完了。release/ には現在 ${all.length} 個の成果物があります:`)
for (const f of all.sort()) console.log(`  - ${f}`)
