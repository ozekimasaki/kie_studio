# AGENTS.md — KIE STUDIO

このリポジトリで働くコーディングエージェント向けのメモ。

## プロジェクト概要

kie.ai Market API の **IMAGE / VIDEO** を試すローカル Studio。

- **Frontend**: `src/` — Vite + React 19 + Tailwind CSS v4 + TanStack Query
- **Backend**: `server/` — Hono（`127.0.0.1:8787`）。Vite が `/api` をプロキシ
- **Catalog**: `src/data/catalog.json` — docs OpenAPI から `npm run sync:models` で再生成
- **Secrets**: `.env` の `KIE_API_KEY` のみサーバー側。フロントに出さない

## ディレクトリの目安

| パス | 役割 |
|------|------|
| `src/components/` | UI（DynamicForm, HistoryGallery, PromptOptimize 等） |
| `src/lib/` | API クライアント・履歴・モデル型 |
| `server/routes/` | Hono ルート |
| `server/kie/` | kie.ai Market / Upload クライアント |
| `server/grok/` | プロンプト最適化（Grok CLI） |
| `server/catalog/` | カタログ同期 |
| `scripts/` | CLI（`sync-models` 等） |

## 作業ルール

- ユーザーが明示しない限り **コミットしない**。コミットメッセージは日本語（conventional commits）
- `.env` / 秘密情報はコミットしない
- 既存の型・命名・UI パターンに合わせる。不要なリファクタやドキュメント追加はしない
- インライン import 禁止（ファイル先頭にまとめる）
- union / enum の `switch` は `default` で `never` チェック

## Git: push を忘れるな（超重要）

**このリポジトリのオーナーは `git push` を忘れがち。**

コミットや PR 作業が一段落したら、必ず確認すること:

1. `git status` で ahead / 未追跡を見る
2. リモート未反映なら **`git push`（必要なら `-u`）までやる**
3. PR 作成時も「push 済みか」を先に確認する

`commit` しただけで満足して終わりがちなので、エージェント側から「push までやりますか？」と確認するか、ユーザーが push まで依頼しているなら最後まで実行する。**ローカルにだけ積んで放置しない。**

## よく触るコマンド

```bash
npm run dev              # server + web
npm run lint
npm run build
npm run sync:models      # カタログ同期
npm run sync:models -- --force
```

## 触るときの注意

- カタログ同期は起動時に古いときだけ走る。毎回フル同期しない設計を壊さない
- Seedance 等のリファレンスキー名・メンションタグは末尾スペースや表記ゆれに敏感
- 履歴は localStorage。ピン上限・インポート正規化・入力復元の安全策を維持する
- プロンプト最適化は Grok CLI 依存。未インストール時は 503 でよい
- Music / Suno / Veo / Runway 等の専用 API はスコープ外
