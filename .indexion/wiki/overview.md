# Overview

kie.ai Market API の **IMAGE / VIDEO** 生成を試すローカル Studio。

API キーはサーバー側（`.env` の `KIE_API_KEY`）にのみ置き、フロントには出さない。

エージェント向けの作業手順・indexion 必須ルールはリポジトリ直下の `AGENTS.md` を正とする。詳細な設計知識はこの wiki（入口: `index.md`）を読む。

## 何ができるか

- カタログ駆動の動的フォーム（OpenAPI スキーマ → フィールド）
- Reference アップロード（画像 / 動画 / 音声）と `@参照` メンション挿入
- 生成タスクの作成・ポーリング・履歴（localStorage）
- プロンプト最適化（Grok CLI）とスニペット挿入
- クレジット残高表示・一時ダウンロード URL

## スコープ外

Music / Suno / Veo / Runway など専用 API、およびチャット系エンドポイントは対象外。

## 技術スタック

| 層 | 技術 |
|----|------|
| Frontend | Vite + React 19 + Tailwind CSS v4 + TanStack Query + Motion |
| Backend | Hono（`127.0.0.1:8787`） |
| Catalog | `src/data/catalog.json`（docs OpenAPI から同期） |
| Proxy | Vite が `/api` → API サーバーへ転送 |
| Knowledge | indexion wiki（`.indexion/wiki/`） |

## See Also

- [Getting Started](wiki://getting-started)
- [Architecture](wiki://architecture)
- [Core Concepts](wiki://core-concepts)
