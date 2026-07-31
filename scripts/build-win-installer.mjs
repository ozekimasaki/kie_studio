/**
 * build-win-installer.mjs
 *
 * Electrobun の Windows ビルド成果物 (`build/<channel>-win-x64/.../Resources/<hash>.tar.zst`)
 * から Inno Setup 製の正式インストーラー/アンインストーラーを生成します。
 *
 * 処理:
 *   1. tar.zst を展開し、アプリツリー (bin/, lib/, Resources/, Info.plist) を
 *      `installer/win/staging/` へ配置（トップレベル dir をフラット化）。
 *   2. ISCC.exe で `installer/win/kie-studio.iss` をコンパイル
 *      （/DAppVersion / /DAppChannel を注入）。
 *   3. 成果物 `release/<channel>-win-x64-KIESTUDIO-Setup.exe` を出力。
 *
 * 前提: Inno Setup 6 が導入済み（`winget install JRSoftware.InnoSetup --scope user`）。
 * 実行: npm run desktop:installer:win [channel]   （CHANNEL 環境変数でも指定可）
 */
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const channel = process.env.CHANNEL ?? process.argv[2] ?? 'canary'
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

const issDir = join(root, 'installer', 'win')
const issPath = join(issDir, 'kie-studio.iss')
const stagingDir = join(issDir, 'staging')

// 旧プローブ用スクラッチがあれば掃除（スクリプト管理外の残骸）。
rmSync(join(issDir, '_probe'), { recursive: true, force: true })

// --- 1. tar.zst を特定 ---
const buildPlatformDir = join(root, 'build', `${channel}-win-x64`)
if (!existsSync(buildPlatformDir)) {
  console.error(`[win-installer] ${buildPlatformDir} が見つかりません。先に desktop:package:${channel} を実行してください。`)
  process.exit(1)
}
const inner = readdirSync(buildPlatformDir).find((n) => statSync(join(buildPlatformDir, n)).isDirectory())
if (!inner) throw new Error(`[win-installer] ${buildPlatformDir} 下にアプリバンドル dir がありません。`)
const resDir = join(buildPlatformDir, inner, 'Resources')
const zstName = readdirSync(resDir).find((f) => f.endsWith('.tar.zst'))
if (!zstName) throw new Error(`[win-installer] ${resDir} 下に *.tar.zst がありません。`)
const zstPath = join(resDir, zstName)
console.log(`[win-installer] source: ${zstPath}`)

// --- 2. 展開 → staging へフラット化 ---
const tmp = mkdtempSync(join(tmpdir(), 'kie-staging-'))
try {
  try {
    // Windows 10 1803+ の tar.exe (libarchive) は zstd をネイティブ展開できる。
    execSync(`tar -xf "${zstPath}" -C "${tmp}"`, { stdio: 'inherit' })
  } catch {
    // フォールバック: インストール済みアプリ同梱の zig-zstd で .tar に戻してから展開。
    const zigZstd = join(process.env.LOCALAPPDATA ?? '', 'ai.kie.studio', channel, 'app', 'bin', 'zig-zstd.exe')
    if (!existsSync(zigZstd)) throw new Error('[win-installer] tar 展開に失敗し、zig-zstd フォールバックも利用できません。')
    const tarFile = join(tmp, 'payload.tar')
    execSync(`"${zigZstd}" -d "${zstPath}" -o "${tarFile}" -f`, { stdio: 'inherit' })
    execSync(`tar -xf "${tarFile}" -C "${tmp}"`, { stdio: 'inherit' })
  }

  const topEntries = readdirSync(tmp).filter((n) => n !== 'payload.tar')
  if (topEntries.length !== 1) throw new Error(`[win-installer] tar.zst のトップレベルが想定外です: ${topEntries.join(', ')}`)
  const srcTree = join(tmp, topEntries[0])

  rmSync(stagingDir, { recursive: true, force: true })
  mkdirSync(stagingDir, { recursive: true })
  for (const entry of readdirSync(srcTree)) {
    cpSync(join(srcTree, entry), join(stagingDir, entry), { recursive: true })
  }
  console.log(`[win-installer] staging 構築完了: ${readdirSync(stagingDir).join(', ')}`)

  // --- 2.5 launcher.exe へアイコン/バージョン情報を埋め込み ---
  // Electrobun 本体は rcedit のパス解決バグ（CI ビルドパス参照）で build.win.icon の
  // 埋め込みに失敗するため、自前で rcedit を実行しタスクバー/ウィンドウ/Explorer 表示を改善。
  // 失敗してもビルドは続行（ショートカット/ARP の app.ico で可視アイコンは担保済み）。
  const launcherExe = join(stagingDir, 'bin', 'launcher.exe')
  const iconIco = join(root, 'assets', 'icon.ico')
  if (existsSync(launcherExe) && existsSync(iconIco)) {
    try {
      const { rcedit } = await import('rcedit')
      await rcedit(launcherExe, {
        icon: iconIco,
        'version-string': {
          FileDescription: 'KIE STUDIO',
          ProductName: 'KIE STUDIO',
          CompanyName: 'KIE STUDIO',
          OriginalFilename: 'launcher.exe',
        },
        'file-version': version,
        'product-version': version,
      })
      console.log('[win-installer] launcher.exe へアイコン/バージョン情報を埋め込み済み')
    } catch (err) {
      console.warn(`[win-installer] launcher.exe へのアイコン埋め込みに失敗（無視して続行）: ${err.message}`)
    }
  }

  // --- 3. ISCC.exe を探索 ---
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ]
  let iscc = candidates.find(existsSync)
  if (!iscc) {
    try {
      iscc = execSync('where iscc', { encoding: 'utf8' }).trim().split(/\r?\n/)[0]
    } catch {
      iscc = undefined
    }
  }
  if (!iscc) {
    console.error('[win-installer] ISCC.exe が見つかりません。導入: winget install JRSoftware.InnoSetup --scope user')
    process.exit(1)
  }
  console.log(`[win-installer] ISCC: ${iscc}`)

  // --- 4. コンパイル ---
  execSync(
    `"${iscc}" /DAppVersion=${version} /DAppChannel=${channel} /Q "${issPath}"`,
    { stdio: 'inherit' },
  )

  const outExe = join(root, 'release', `${channel}-win-x64-KIESTUDIO-Setup.exe`)
  if (!existsSync(outExe)) throw new Error(`[win-installer] 成果物が見つかりません: ${outExe}`)
  console.log(`[win-installer] 完了: ${outExe}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
