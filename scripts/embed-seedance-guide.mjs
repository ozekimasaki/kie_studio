// Seedance ガイド md を server/grok/guides/seedance.ts に埋め込むワンショット生成スクリプト
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const SRC = 'Seedance_2.0_Complete_Prompting_Guide_JA.md'
const DEST = 'server/grok/guides/seedance.ts'

const src = readFileSync(SRC, 'utf8')
const escaped = src
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${')

mkdirSync('server/grok/guides', { recursive: true })

const out = [
  '// Seedance_2.0_Complete_Prompting_Guide_JA.md から生成した埋め込みガイド。',
  '// デスクトップ版はバンドル後のファイルパス解決に依存できないため、ガイド本文はコードに埋め込む。',
  '// 内容を更新するときは scripts/embed-seedance-guide.mjs を再実行すること。',
  '',
  "export const SEEDANCE_GUIDE_FILE_NAME = 'Seedance_2.0_Complete_Prompting_Guide_JA.md'",
  '',
  'export const SEEDANCE_GUIDE_CONTENT = `' + escaped + '`',
  '',
].join('\n')

writeFileSync(DEST, out, 'utf8')
console.log('written', DEST, out.length, 'chars')
