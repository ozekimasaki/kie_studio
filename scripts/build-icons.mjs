/**
 * build-icons.mjs
 *
 * `assets/icon-master.svg` からデスクトップアプリ用アイコンを生成します。
 * Electrobun は SVG を直接扱えず、Windows は `.ico`、Linux は `.png`、
 * macOS は `.iconset` フォルダを要求するため、ここでベクターマスターをラスター化します。
 *
 * 生成物:
 * - assets/icon.ico      : Windows 用マルチサイズ ICO (16/24/32/48/64/256)
 * - assets/icon.png      : Linux 用 PNG (512x512)
 * - assets/icon.iconset/ : macOS 用 iconset (16〜1024px, iconutil で .icns に変換される)
 *
 * 依存（devDependencies）: sharp（SVG ラスタライズ + リサイズ）, png-to-ico（ICO 生成）
 * 実行: npm run icons
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

// macOS iconset: iconutil が .icns へ変換する際の規約に沿ったファイル群。
// ビルド時（macOS ランナー）に Electrobun が iconutil で AppIcon.icns を生成する。
const iconsetDir = join(assetsDir, 'icon.iconset')
mkdirSync(iconsetDir, { recursive: true })
const iconsetSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
]
for (const [size, name] of iconsetSizes) {
  writeFileSync(join(iconsetDir, name), await raster(size))
}
console.log(`[build-icons] assets/icon.iconset/ (${iconsetSizes.length} files)`)

console.log('[build-icons] 完了。')
