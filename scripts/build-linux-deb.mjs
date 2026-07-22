/**
 * build-linux-deb.mjs
 *
 * Electrobun の Linux ビルド成果物（`build/<channel>-linux-x64/<AppName>/`：
 * bin/launcher・lib/・Resources/・Info.plist・*.desktop を含む実行可能ツリー）
 * から `.deb` パッケージを生成します。
 *
 * Electrobun 自体は Linux 向けに tar.gz しか出力しないため（`.deb` 非対応）、
 * ここで dpkg-deb を使って自前でパッケージ化します（Windows の Inno Setup 相当）。
 *
 * レイアウト:
 *   /opt/kie-studio/<channel>/                 ← アプリ本体ツリー
 *   /usr/bin/kie-studio-<channel>              ← launcher を呼ぶラッパー
 *   /usr/share/applications/…desktop           ← メニュー登録（絶対 Exec/Icon）
 *   /usr/share/icons/hicolor/256x256/apps/…png ← アイコン
 *
 * 前提: Linux ホスト（または WSL）で dpkg-deb が利用可能なこと。
 *   Windows では実行できません（CI の Linux ランナー or WSL で実行してください）。
 *
 * 実行: npm run desktop:installer:deb [channel]   （CHANNEL 環境変数でも指定可）
 */
import {
  chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync,
  readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.env.CHANNEL ?? process.argv[2] ?? 'canary'
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

// dpkg-deb は Linux ツール。Windows では動かないため早期に案内して終了する。
if (process.platform !== 'linux') {
  console.error(
    `[deb] このスクリプトは Linux 上で実行してください（現在: ${process.platform}）。\n` +
    '      Windows の場合は WSL、または CI の Linux ランナーで実行します。',
  )
  process.exit(1)
}
try {
  execSync('command -v dpkg-deb', { stdio: 'ignore' })
} catch {
  console.error('[deb] dpkg-deb が見つかりません。導入: sudo apt-get install -y dpkg-dev')
  process.exit(1)
}

// --- 1. Linux ビルドツリーを特定 ---
const buildPlatformDir = join(root, 'build', `${channel}-linux-x64`)
if (!existsSync(buildPlatformDir)) {
  console.error(`[deb] ${buildPlatformDir} が見つかりません。先に desktop:package:${channel} を実行してください。`)
  process.exit(1)
}
const inner = readdirSync(buildPlatformDir).find((n) => statSync(join(buildPlatformDir, n)).isDirectory())
if (!inner) throw new Error(`[deb] ${buildPlatformDir} 下にアプリバンドル dir がありません。`)
const appTree = join(buildPlatformDir, inner)
const launcher = join(appTree, 'bin', 'launcher')
if (!existsSync(launcher)) throw new Error(`[deb] launcher が見つかりません: ${launcher}`)
console.log(`[deb] source app tree: ${appTree}`)

// --- 2. deb ルートを構築 ---
const pkgName = `kie-studio-${channel}`
const installDir = `/opt/kie-studio/${channel}`
const tmp = mkdtempSync(join(tmpdir(), 'kie-deb-'))
try {
  const debRoot = join(tmp, 'root')

  // 2.1 アプリ本体を /opt/kie-studio/<channel>/ へ
  const optDest = join(debRoot, 'opt', 'kie-studio', channel)
  mkdirSync(optDest, { recursive: true })
  for (const entry of readdirSync(appTree)) {
    cpSync(join(appTree, entry), join(optDest, entry), { recursive: true })
  }
  chmodSync(join(optDest, 'bin', 'launcher'), 0o755)

  // 2.2 /usr/bin ラッパー（launcher を絶対パスで exec）
  const usrBin = join(debRoot, 'usr', 'bin')
  mkdirSync(usrBin, { recursive: true })
  const wrapper = join(usrBin, pkgName)
  writeFileSync(wrapper, `#!/bin/sh\nexec "${installDir}/bin/launcher" "$@"\n`, 'utf8')
  chmodSync(wrapper, 0o755)

  // 2.3 アイコン（hicolor テーマ）
  const iconSrc = join(root, 'assets', 'icon.png')
  const iconDestDir = join(debRoot, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps')
  mkdirSync(iconDestDir, { recursive: true })
  if (existsSync(iconSrc)) {
    cpSync(iconSrc, join(iconDestDir, `${pkgName}.png`))
  } else {
    console.warn(`[deb] ${iconSrc} が無いためアイコンをスキップ`)
  }

  // 2.4 .desktop（システム全体メニュー用に絶対 Exec / テーマ Icon 名）
  const appsDir = join(debRoot, 'usr', 'share', 'applications')
  mkdirSync(appsDir, { recursive: true })
  const desktop = [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    `Name=KIE STUDIO${channel === 'stable' ? '' : ` (${channel})`}`,
    'Comment=kie.ai Market API image/video/audio studio',
    `Exec=${installDir}/bin/launcher`,
    `Icon=${pkgName}`,
    'Terminal=false',
    'StartupWMClass=KIE STUDIO',
    'Categories=Utility;AudioVideo;',
    '',
  ].join('\n')
  writeFileSync(join(appsDir, `${pkgName}.desktop`), desktop, 'utf8')

  // 2.5 DEBIAN/control
  const debianDir = join(debRoot, 'DEBIAN')
  mkdirSync(debianDir, { recursive: true })
  // インストールサイズ（KiB）。dpkg 慣習に沿って概算で埋める。
  const installedSize = Math.max(
    1,
    Math.round(dirSizeBytes(optDest) / 1024),
  )
  const control = [
    `Package: ${pkgName}`,
    `Version: ${version}`,
    'Section: utils',
    'Priority: optional',
    'Architecture: amd64',
    'Maintainer: KIE STUDIO <noreply@kie.ai>',
    // Electrobun Linux（bundleCEF: false）は GTK + WebKitGTK を利用する。
    'Depends: libgtk-3-0, libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37',
    `Installed-Size: ${installedSize}`,
    'Description: KIE STUDIO',
    ' Local studio for kie.ai Market API image/video/audio workflows.',
    '',
  ].join('\n')
  writeFileSync(join(debianDir, 'control'), control, 'utf8')

  // --- 3. dpkg-deb でパッケージ化 ---
  const releaseDir = join(root, 'release')
  mkdirSync(releaseDir, { recursive: true })
  const outDeb = join(releaseDir, `${channel}-linux-x64-KIESTUDIO-${version}.deb`)
  rmSync(outDeb, { force: true })
  execSync(`dpkg-deb --build --root-owner-group "${debRoot}" "${outDeb}"`, { stdio: 'inherit' })

  if (!existsSync(outDeb)) throw new Error(`[deb] 成果物が見つかりません: ${outDeb}`)
  console.log(`[deb] 完了: ${outDeb}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

/** ディレクトリ配下の合計バイト数を再帰計算する。 */
function dirSizeBytes(dir) {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) total += dirSizeBytes(p)
    else if (entry.isFile()) total += statSync(p).size
  }
  return total
}
