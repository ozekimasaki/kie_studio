/**
 * build-icons.mjs
 *
 * `assets/icon-master.svg` からデスクトップアプリ用アイコンを生成します。
 * Electrobun は SVG を直接扱えず、Windows は `.ico`、Linux は `.png` を要求するため、
 * ここでベクターマスターをラスター化します。
 *
 * 生成物:
 * - assets/icon.ico : Windows 用マルチサイズ ICO (16/24/32/48/64/256)
 * - assets/icon.png : Linux 用 PNG (512x512)
 *
 * 依存（devDependencies）: sharp（SVG ラスタライズ + リサイズ）, png-to-ico（ICO 生成）
 * 実行: npm run icons
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = join(root, 'assets')
const svg = readFileSync(join(assetsDir, 'icon-master.svg'))

// 高解像度で一度ラスタライズし、各サイズへ縮小してエッジを鮮明に保つ。
const base = await sharp(svg, { density: 150 }).resize(1024, 1024, { fit: 'fill' }).png().toBuffer()
const raster = (size) => sharp(base).resize(size, size, { fit: 'fill' }).png().toBuffer()

// Windows ICO: よく使われるサイズをまとめて埋め込む（256 が ICO の上限）。
const icoSizes = [16, 24, 32, 48, 64, 256]
const icoPngs = []
for (const s of icoSizes) icoPngs.push(await raster(s))
const ico = await pngToIco(icoPngs)
writeFileSync(join(assetsDir, 'icon.ico'), ico)
console.log(`[build-icons] assets/icon.ico (${icoSizes.join('/')} px, ${ico.length} bytes)`)

// Linux PNG: 256 以上が推奨。512 を出力。
const linux = await raster(512)
writeFileSync(join(assetsDir, 'icon.png'), linux)
console.log(`[build-icons] assets/icon.png (512 px, ${linux.length} bytes)`)

console.log('[build-icons] 完了。')
