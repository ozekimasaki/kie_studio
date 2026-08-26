# Getting Started

## セットアップ

```bash
cp .env.example .env
# .env に KIE_API_KEY を設定
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787（Vite が `/api` をプロキシ）
- エージェント: 同じ API プロセス（`POST /api/agent/chat`）。別 sidecar は無い
- DB: `data/studio.db`（自動作成、gitignore）

プロンプト最適化を使う場合は Grok CLI を用意するか `.env` に `XAI_API_KEY` を設定する。エージェントの Grok も同じ `XAI_API_KEY`（Settings でも可）。

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | 必須。kie.ai API キー |
| `PORT` | API ポート（既定 `8787`） |
| `XAI_API_KEY` | 任意。エージェント Grok（組み込み xai）と Grok CLI |
| `SYNC_MODELS_ON_START` | `0` で起動時同期を無効化 |
| `SYNC_MODELS_FORCE` | `1` で強制同期 |
| `SYNC_CONCURRENCY` | 同期並列数（既定 12、最大 32） |

## よく使うコマンド

```bash
npm run dev
npm test
npm run lint
npm run build
npm run sync:models
npm run sync:models -- --force
npm run kiestudio -- --help
```

起動時同期は既存カタログが古い場合だけ実行し、失敗時も既存カタログで起動を続ける。

## CLI

`kiestudio` は起動中の Studio API のクライアント。生成結果は同じ SQLite 履歴に載り、Gallery で管理する。

```bash
kiestudio up
kiestudio models --category image
kiestudio generate -m flux-kontext-pro -p "a red bicycle" --wait
kiestudio history
```

API 未起動時は `kiestudio up` または `npm run dev`。エージェント向け手順は `.cursor/skills/kiestudio-cli/SKILL.md`。

## See Also

- [Overview](wiki://overview)
- [Architecture](wiki://architecture)
- [Catalog Sync](wiki://catalog-sync)
