# AGENTS.md — KIE STUDIO

このリポジトリで働くコーディングエージェント向けのメモ。

## プロジェクト概要

kie.ai Market API と専用 workflow の **IMAGE / VIDEO / AUDIO** を扱うローカル Studio。

| 層 | 技術・置き場 |
|----|----------------|
| Frontend | `src/` — Vite + React 19 + Tailwind CSS v4 + TanStack Query + Motion |
| Backend | `server/` — Hono（`127.0.0.1:8787`）。dev/デスクトップ共に **Bun ランタイム**で `Bun.serve` 起動。Vite が `/api` をプロキシ |
| Desktop | Electrobun（Bun メインプロセス `src/bun/index.ts` + ネイティブ webview）。設定は `electrobun.config.ts` |
| Catalog | `src/data/catalog.json` の docs OpenAPI と `server/catalog/dedicated.ts` の専用 workflow を統合 |
| Secrets | `KIE_API_KEY`。`.env` または SQLite `app_settings`（設定画面で保存）。保存キーが env より優先。フロントに出さない |

provider は Market / Suno / Veo / Runway。チャット系 API はスコープ外。

## indexion（必須）

リポジトリ知識は **indexion wiki** と **agent orient** を正とする。推測でディレクトリを渡り歩かない。

### バイナリ（Windows）

```powershell
# PATH に無い場合
$env:Path = "$env:USERPROFILE\.indexion\bin;$env:Path"
# または: & "$env:USERPROFILE\.indexion\bin\indexion.exe" ...
```

- バイナリ: `%USERPROFILE%\.indexion\bin\indexion.exe`
- KGF: `$env:INDEXION_KGFS_DIR` → `%LOCALAPPDATA%\Indexion\kgfs`

### 実装前（必ず）

1. 入口を読む: `.indexion/wiki/index.md`
2. タスクに近い hub を読む（Architecture / Core Concepts / Frontend / Server API など）
3. 触る場所が曖昧なら orient:

```powershell
indexion agent orient --task "<英語の目的 gloss>" --output .indexion/cache/agent/orient.md .
```

日本語タスクでも、`--task` にはコードベース語彙の短い gloss を渡す（疑わしい owner 名は書かない）。

### 検索

```powershell
indexion search "history pin SQLite" src/
indexion grep "createTask" server/
```

### Wiki を更新したら（`.md` 直編集禁止）

ページ本文は `indexion wiki pages add|update` 経由のみ。直編集したら必ず `pages update` で manifest / 検索 index / log を同期する。

```powershell
indexion wiki pages ingest --wiki-dir=.indexion/wiki
indexion wiki lint --wiki-dir=.indexion/wiki
indexion wiki index build --wiki-dir=.indexion/wiki
```

Wiki ページ一覧（詳細は各 `.indexion/wiki/*.md`）:

| id | 内容 |
|----|------|
| `overview` / `getting-started` / `architecture` / `core-concepts` | 全体・セットアップ・層・概念 |
| `frontend` / `client-lib` | UI・`src/lib` |
| `server-api` / `kie-integration` | Hono ルート・kie クライアント |
| `catalog-sync` / `prompt-optimize` | カタログ同期・Grok 最適化 |

## ディレクトリ構成

```text
src/
  App.tsx, main.tsx, index.css
  components/          # 画面 UI
    audio/             # 会話・ナレーション編集、常駐プレイヤー
    shell/             # StudioShell, FloatingChrome
    motion/            # Pressable, Material, SpringSheet, SharedMedia
  lib/
    api.ts, history.ts, submissionQueue.ts, workflowValidation.ts, media*.ts
    models/            # types, from-openapi, mentions
  data/catalog.json
src/bun/
  index.ts             # Electrobun メインプロセス（Bun.serve + BrowserWindow + updater）
server/
  app.ts               # createApp(): Hono 本体（CORS・health・route 登録・onError）
  index.ts             # dev エントリ（Bun.serve で createApp を起動・起動時 sync）
  routes/              # upload, generate, task, Suno, archive, history, settings, ...
  db/                  # bun:sqlite（履歴・Persona・音源素材・app_settings）
  settings/            # API キー取得（保存ストア→env フォールバック）
  kie/adapters/        # Market / Suno / Veo / Runway の共通化
  grok/                # Grok CLI 最適化
  catalog/             # docs catalog 同期 + 専用 workflow
electrobun.config.ts   # Electrobun ビルド設定
scripts/sync-models.ts
.indexion/wiki/        # プロジェクト知識ベース
```

| パス | 役割 |
|------|------|
| `src/App.tsx` | フォーム・キュー・履歴・ポーリング・Quick Action の調停 |
| `src/components/DynamicForm.tsx` | カタログ駆動フォーム |
| `src/components/HistoryGallery.tsx` / `HistorySheets.tsx` | 履歴・複数メディア・同期歌詞・再試行・入出力 |
| `src/components/audio/` | 会話・ナレーション編集と常駐プレイヤー |
| `src/components/ReferenceUpload.tsx` | 参照メディア upload |
| `src/components/PromptOptimizePanel.tsx` | プロンプト最適化 UI |
| `src/components/KlingElementsEditor.tsx` | Kling Elements |
| `src/components/shell/` | レイアウト枠 |
| `src/components/motion/` + `src/lib/motion.ts` | インタラクション / モーション |
| `src/lib/api.ts` | `/api` クライアント（キーは持たない） |
| `src/lib/history.ts` | 履歴の純粋関数（cap・正規化）。永続化は SQLite via `/api/history` |
| `src/lib/submissionQueue.ts` | 未送信キュー・再試行・レート制御 |
| `src/lib/workflowValidation.ts` | provider / operation 別の送信前検証 |
| `src/lib/models/` | 型・OpenAPI 抽出・メンション |
| `src/bun/index.ts` | Electrobun メインプロセス。`STUDIO_DB_PATH` を userData に設定 → `Bun.serve` → webview 起動 |
| `server/app.ts` | `createApp()` で Hono を構築（dev / デスクトップ共用） |
| `server/routes/` | HTTP 境界（`settings.ts` で API キー管理） |
| `server/db/` | bun:sqlite（既定 `data/studio.db`、`STUDIO_DB_PATH` で上書き） |
| `server/settings/` | 保存ストア優先の API キー取得ヘルパ |
| `server/kie/adapters/` | Market / Suno / Veo / Runway の生成・状態・エラーを正規化 |
| `server/grok/` | Grok CLI |
| `server/catalog/` + `scripts/` | カタログ同期 |
| `.indexion/wiki/` | indexion 知識ベース |

## 作業ルール

- ユーザーが明示しない限り **コミットしない**。コミットメッセージは日本語（conventional commits）
- `.env` / 秘密情報はコミットしない
- 既存の型・命名・UI パターンに合わせる。不要なリファクタやドキュメント追加はしない
- インライン import 禁止（ファイル先頭にまとめる）
- union / enum の `switch` は `default` で `never` チェック
- **コード編集後は必ず検証コマンドを実行する**: `npm run lint && npm test && npx tsc -b`（3 つすべてが成功することを確認してから完了とする）
- 大きな機能変更の前後で、関係する wiki ページを `ingest` → 必要なら `pages update`

## Skills ルーティング

このプロジェクトのスタック（Vite + React 19 + Tailwind CSS v4 + Hono + Bun + Vitest + oxlint + Motion）に合致する Skill のみ使用する。

### 有効な Skills

| カテゴリ | Skill 名 | 用途 |
|---------|----------|------|
| React | `react-best-practices` | React 19 パフォーマンス・パターン |
| テスト | `vitest` | Vitest 単体テスト・モック・fixture |
| バックエンド | `hono` | Hono ルート・ミドルウェア・バリデーション |
| ビルド | `vite` | Vite 設定・プラグイン・SSR |
| Lint | `oxlint` | oxlint 設定・ルール |
| CSS | `tailwind-css-patterns` | Tailwind CSS v4 ユーティリティ |
| アクセシビリティ | `accessibility`, `fixing-accessibility` | WCAG 監査・修正 |
| デザイン | `impeccable`, `baseline-ui`, `emil-design-eng`, `make-interfaces-feel-better`, `apple-design` | UI 品質（DESIGN.md 優先順位に従う） |
| モーション | `animation-principles`, `mastering-animate-presence` | Motion / AnimatePresence |
| 型 | `typescript-advanced-types` | 高度な型設計 |
| デバッグ | `diagnosing-bugs`, `systematic-debugging` | 障害診断 |
| リファクタ | `refactor`, `improve-codebase-architecture` | 安全なリファクタリング |

### 使用しない Skills

以下はこのプロジェクトのスタック外のため **使用禁止**:

- **Vue / Nuxt 系**: `vue`, `vue-best-practices`, `nuxt`, `pinia`, `vue-router-best-practices`, `vueuse-functions` 等
- **Next.js 系**: `next-best-practices`, `next-upgrade`, `next-rspack`, `next-cache-components` 等
- **Remotion 系**: `remotion-*` 全て
- **Three.js 系**: `threejs-*` 全て
- **Svelte 系**: `svelte-code-writer` 等
- **Cloudflare 系**: `cloudflare`, `wrangler`, `durable-objects`, `workers-best-practices` 等
- **Supabase 系**: `supabase`, `supabase-postgres-best-practices`
- **その他フレームワーク**: `react-router-framework-mode`, `react-native-best-practices`, `swiftui-ui-patterns`

### デザイン Skill 優先順位

競合時は `DESIGN.md`「Skill priority on conflict」のチェインに従う:

> impeccable → baseline-ui → design-system → emil-design-eng → apple-design (sheet only) → make-interfaces-feel-better

## Git: push を忘れるな（超重要）

**このリポジトリのオーナーは `git push` を忘れがち。**

コミットや PR 作業が一段落したら:

1. `git status` で ahead / 未追跡を見る
2. リモート未反映なら **`git push`（必要なら `-u`）までやる**
3. PR 作成時も「push 済みか」を先に確認する

`commit` だけで終わらせない。ユーザーが push まで依頼しているなら最後まで実行する。依頼が無い場合は「push までやりますか？」と確認する。

## セットアップ

```bash
cp .env.example .env     # KIE_API_KEY を設定
npm install
npm run dev              # Web http://localhost:5173 / API http://127.0.0.1:8787
```

Node.js は Vite 8 / React 19 が動作する LTS（目安 20.19+ / 22.12+）。

## よく触るコマンド

```bash
npm run dev              # server + web（dev:server + dev:web）
npm run dev:server       # Hono API のみ（bun --watch server/index.ts）
npm run desktop:dev      # Electrobun デスクトップを開発起動（要 Bun）
npm run desktop:build:canary  # canary デスクトップビルド（vite build + electrobun build）
npm run desktop:build:stable  # stable デスクトップビルド
npm run desktop:package:canary  # canary 再パッケージ（vite build スキップ + release/ 集積）
npm run desktop:package:linux:canary  # Linux 再パッケージ（bun 駆動 / icons スキップ / WSL 可）
npm run desktop:build:linux:canary    # Linux フルビルド（vite build + electrobun build、bun 駆動）
npm run desktop:installer:win   # Windows Inno Setup インストーラー生成（要 Inno Setup 6）
npm run desktop:installer:deb   # Linux .deb 生成（要 Linux/WSL + dpkg-deb、bun 駆動）
npm run icons                   # assets/icon-master.svg → icon.ico / icon.png
npm run dev:web          # Vite のみ
npm run lint             # oxlint（設定: .oxlintrc.json）
npm test                 # Vitest を1回実行
npm run test:watch       # Vitest watch
npx tsc -b               # 型チェックのみ（build にも含まれる）
npm run build            # tsc -b + vite build
npm run preview          # ビルド成果物をプレビュー
npm run sync:models      # カタログ同期
npm run sync:models -- --force
```

- 検証は `npm run lint` + `npm test` + `npx tsc -b` + `npm run build` を基本とする。

## 触るときの注意

- カタログ同期は起動時に古いときだけ走る。毎回フル同期しない設計を壊さない
- Seedance 等のリファレンスキー名・メンションタグは末尾スペースや表記ゆれに敏感
- 履歴は bun:sqlite（既定 `data/studio.db`、デスクトップは `STUDIO_DB_PATH` で userData 配下）。ピン上限・インポート正規化・入力復元の安全策を維持する
- provider / operation 差分は `server/kie/adapters/` で正規化し、共通 task/history 契約を維持する
- Persona と外部音源メタデータは SQLite に保存する。メディア本体は保存しない
- 旧 localStorage キーは初回起動時に `POST /api/history/migrate` で移行する
- プロンプト最適化は Grok CLI 依存。未インストール時は 503 でよい
- `FieldType` / 特殊 UI を増やすときは `types.ts` → `DynamicForm` → 必要ならカタログ抽出を一連で見る
- Suno / Veo / Runway の専用 workflow は `server/catalog/dedicated.ts` と adapter を一連で見る

### デスクトップ配布（Electrobun + Inno Setup）

- **Windows の第一導線は Inno Setup**（`installer/win/kie-studio.iss` + `scripts/build-win-installer.mjs`）。Electrobun 純正 Setup.exe は ARP 未登録・アンインストーラー不完全のため採用しない。インストール先は Electrobun 既定（`%LocalAppData%\ai.kie.studio\<ch>\app`）と完全一致させ、自動アップデート期待パスを維持する。
- **ユーザー DB を壊すな（最重要）**: `studio.db`（+ WAL/SHM）はインストール先 `app\` の**親**（`...\<ch>\`）にある。アンインストールで `app\` のみ削除し、親ディレクトリには絶対に触れないこと（DB 破壊の破滅的行為）。
- **アイコン**: `assets/icon-master.svg` → `npm run icons`（sharp + png-to-ico）で `icon.ico`/`icon.png`。Electrobun 本体は rcedit のパス解決バグ（CI ビルドパス参照）で `build.win.icon` の埋め込みに失敗するため、`build-win-installer.mjs` が staging の launcher.exe へ自前で rcedit 埋め込みする（失敗してもビルドは続行、ショートカット/ARP の app.ico で可視アイコンは担保）。
- **arm64**: win-arm64 は x64 版が OS エミュレーションで動作するため個別ビルド不要。linux-arm64 はクロスビルド不可のため一旦見送り。Electrobun 自体の Linux 出力は tar.gz のみ（`.deb`/AppImage 非対応）だが、`scripts/build-linux-deb.mjs`（`npm run desktop:installer:deb`）が tar.gz ではなく `build/<ch>-linux-x64/` の実行ツリーから `dpkg-deb` で `.deb` を自前生成する（Windows の Inno Setup と同じく後段ラップ）。`.deb` は Linux/WSL 上でのみビルド可能。インストール先は `/opt/kie-studio/<ch>/`、`.desktop`/アイコンは `/usr/share/` 配下。
- **release/ 集積**: Electrobun はビルドごとに `artifacts/` を削除・再生成し他プラットフォーム成果物が消えるため、`scripts/collect-release.mjs` が永続的な `release/` へコピーする（ファイル名のプラットフォーム接頭辞で衝突せず両方蓄積）。
- **WSL での Linux ビルド**: WSL に node が無くてもよい（native Linux Bun のみで完結）。win/linux ビルドはこの点で統一されている——`desktop:*:linux:*` スクリプトは `bun` で vite/electrobun の bin を直接実行する（bin の node shebang を回避）。`bun run desktop:package:linux:canary` → `bun run desktop:installer:deb canary` で `.deb` まで生成できる。`icons`（sharp）は Linux ではスキップ——`assets/icon.png` はコミット済みで `electrobun.config.ts` の `linux.icon` がそれを使う。`better-sqlite3` は test 専用（server は `bun:sqlite`）なので build には不要。カタログ同期は win/linux 共通で `STUDIO_CATALOG_PATH`（userData の writable path）に bundle スナップショットを seed して動く（`src/bun/index.ts`）。
- **リリース CI（`.github/workflows/release.yml`）**: `v*` tag の push で mac/win/linux を並列ビルドし GitHub Releases へ公開する（`v*-canary`/`-beta`/`-rc` は canary prerelease、それ以外は stable）。Linux ジョブは electrobun build 後に `scripts/build-linux-deb.mjs` を実行し、生成した `.deb` を `artifacts/` へコピーして配布物に含める（`dpkg-deb` は Ubuntu ランナーに同梱）。`app.version`（`electrobun.config.ts`）は `package.json` の version と揃える。新しい canary は version を上げて `v<version>-canary` tag を push する。

### リリース失敗時の最小回復手順

リリースパイプライン（CI またはローカル）が失敗した場合、**再ビルド → 再パッケージ → 再デプロイ** の順で復帰する。各ステップで前段階の成功を確認してから次に進む。

#### 1. 再ビルド（型チェック + Vite + Electrobun）

```bash
# 失敗原因の切り分け: 型エラーかバンドルエラーか
npx tsc -b                        # 型チェック
npm run build                     # tsc -b + vite build（フロントエンド）
npm run desktop:build:canary      # canary: vite build + electrobun build（フルビルド）
# npm run desktop:build:stable    # stable: 同上（stable チャネル）
```

確認ポイント:
- `npx tsc -b` が 0 で終了すること
- `npm run build` が `dist/` を生成すること
- `desktop:build:*` が `artifacts/` にプラットフォーム成果物を出力すること
- `artifacts/` に期待するファイル（`.exe` / `.tar.gz` 等）が存在すること

#### 2. 再パッケージ（Inno Setup / .deb / release 集積）

ビルドが成功している場合、パッケージングのみ再実行する（`vite build` はスキップ）。

```bash
# Windows: Inno Setup インストーラー
npm run desktop:installer:win

# Linux: .deb（WSL 可）
bun run desktop:installer:deb canary

# 成果物を release/ に集積
node scripts/collect-release.mjs
```

確認ポイント:
- `release/` に最新のインストーラー（`.exe`）/ `.deb` が配置されていること
- `release/` のファイル名にプラットフォーム接頭辞が付き、旧成果物と衝突しないこと
- Inno Setup 失敗時は `installer/win/kie-studio.iss` と `scripts/build-win-installer.mjs` のログを確認する

#### 3. 再デプロイ（GitHub Releases / タグ）

CI が失敗した場合は、修正後にタグを再 push する。

```bash
# バージョン確認（electrobun.config.ts と package.json が一致していること）
# 修正後、タグを打ち直す
git tag -f v<version>-canary       # 既存タグの上書き
git push origin v<version>-canary --force
```

確認ポイント:
- `package.json` の version と `electrobun.config.ts` の `app.version` が一致していること
- タグ名が `v<version>-canary` / `v<version>` の形式であること
- GitHub Actions のリリースワークフローが緑で完了すること
- GitHub Releases の該当リリースに全プラットフォーム成果物がアップロードされていること

#### 回復の判断基準

| 失敗箇所 | 再実行コマンド | 確認 |
|---------|--------------|------|
| 型チェック（`tsc -b`） | コード修正 → `npx tsc -b` | 0 で終了 |
| Vite ビルド | `npm run build` | `dist/` 生成 |
| Electrobun ビルド | `npm run desktop:build:canary` | `artifacts/` に成果物 |
| Inno Setup | `npm run desktop:installer:win` | `release/` に `.exe` |
| .deb パッケージ | `bun run desktop:installer:deb canary` | `release/` に `.deb` |
| CI / GitHub Releases | タグ再 push | ワークフロー成功 + 全成果物アップロード |
