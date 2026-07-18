# AGENTS.md — KIE STUDIO

このリポジトリで働くコーディングエージェント向けのメモ。

## プロジェクト概要

kie.ai Market API の **IMAGE / VIDEO** を試すローカル Studio。

| 層 | 技術・置き場 |
|----|----------------|
| Frontend | `src/` — Vite + React 19 + Tailwind CSS v4 + TanStack Query + Motion |
| Backend | `server/` — Hono（`127.0.0.1:8787`）。Vite が `/api` をプロキシ |
| Catalog | `src/data/catalog.json` — docs OpenAPI から `npm run sync:models` で再生成 |
| Secrets | `.env` の `KIE_API_KEY` のみサーバー側。フロントに出さない |

スコープ外: Music / Suno / Veo / Runway 等の専用 API、チャット系。

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
    shell/             # StudioShell, FloatingChrome
    motion/            # Pressable, Material, SpringSheet, SharedMedia
  lib/
    api.ts, history.ts, media*.ts, snippets.ts, motion.ts
    models/            # types, from-openapi, mentions
  data/catalog.json
server/
  index.ts             # Hono エントリ・CORS・onError・起動時 sync
  routes/              # upload, generate, task, models, credits, history, ...
  db/                  # SQLite（履歴ギャラリー）
  kie/                 # Market / Upload クライアント
  grok/                # Grok CLI 最適化
  catalog/             # docs → catalog.json
scripts/sync-models.ts
.indexion/wiki/        # プロジェクト知識ベース
```

| パス | 役割 |
|------|------|
| `src/App.tsx` | モデル取得・生成・履歴ポーリングのオーケストレーション |
| `src/components/DynamicForm.tsx` | カタログ駆動フォーム |
| `src/components/HistoryGallery.tsx` | 履歴・ピン・再試行・入出力 |
| `src/components/ReferenceUpload.tsx` | 参照メディア upload |
| `src/components/PromptOptimizePanel.tsx` | プロンプト最適化 UI |
| `src/components/KlingElementsEditor.tsx` | Kling Elements |
| `src/components/shell/` | レイアウト枠 |
| `src/components/motion/` + `src/lib/motion.ts` | インタラクション / モーション |
| `src/lib/api.ts` | `/api` クライアント（キーは持たない） |
| `src/lib/history.ts` | 履歴の純粋関数（cap・正規化）。永続化は SQLite via `/api/history` |
| `src/lib/models/` | 型・OpenAPI 抽出・メンション |
| `server/routes/` | HTTP 境界 |
| `server/db/` | SQLite（`data/studio.db`） |
| `server/kie/` | kie.ai 呼び出し |
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
npm run dev:server       # Hono API のみ（tsx watch）
npm run dev:web          # Vite のみ
npm run lint             # oxlint（設定: .oxlintrc.json）
npx tsc -b               # 型チェックのみ（build にも含まれる）
npm run build            # tsc -b + vite build
npm run preview          # ビルド成果物をプレビュー
npm run sync:models      # カタログ同期
npm run sync:models -- --force
```

- テストランナーは未導入（`test` スクリプトなし）。検証は `npm run lint` + `npx tsc -b` + `npm run build` を基本とする。

## 触るときの注意

- カタログ同期は起動時に古いときだけ走る。毎回フル同期しない設計を壊さない
- Seedance 等のリファレンスキー名・メンションタグは末尾スペースや表記ゆれに敏感
- 履歴は SQLite（`data/studio.db`）。ピン上限・インポート正規化・入力復元の安全策を維持する
- 旧 localStorage キーは初回起動時に `POST /api/history/migrate` で移行する
- プロンプト最適化は Grok CLI 依存。未インストール時は 503 でよい
- `FieldType` / 特殊 UI を増やすときは `types.ts` → `DynamicForm` → 必要ならカタログ抽出を一連で見る
- Music / Suno / Veo / Runway 等の専用 API はスコープ外
