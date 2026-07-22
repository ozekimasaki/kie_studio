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
- 大きな機能変更の前後で、関係する wiki ページを `ingest` → 必要なら `pages update`

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
npm run desktop:installer:win   # Windows Inno Setup インストーラー生成（要 Inno Setup 6）
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
- **arm64**: win-arm64 は x64 版が OS エミュレーションで動作するため個別ビルド不要。linux-arm64 はクロスビルド不可のため一旦見送り。Linux 配布は tar.gz のみ（`.deb` は Electrobun 非対応）。
- **release/ 集積**: Electrobun はビルドごとに `artifacts/` を削除・再生成し他プラットフォーム成果物が消えるため、`scripts/collect-release.mjs` が永続的な `release/` へコピーする（ファイル名のプラットフォーム接頭辞で衝突せず両方蓄積）。
