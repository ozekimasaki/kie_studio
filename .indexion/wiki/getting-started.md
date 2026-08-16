# Getting Started

## セットアップ

Bun が `dev:server` と CLI に必要。Node.js は Vite 8 / React 19 が動く LTS（目安 20.19+ / 22.12+）。

```bash
cp .env.example .env
# .env に KIE_API_KEY を設定
npm install
npm run dev
```

`npm run dev` は API + Web + エージェント sidecar を同時起動する。

- Web: http://localhost:5173（Vite。`/api` と `/agents` をプロキシ）
- API: http://127.0.0.1:8787
- Agent sidecar: http://127.0.0.1:8789（root は 404 が正常）
- DB: `data/studio.db`（自動作成、gitignore）
- ローカルメディア: `data/media/`（終端タスクのアーカイブ）

プロンプト最適化を使う場合は Grok CLI を用意するか `.env` に `XAI_API_KEY` を設定する。エージェントの Grok は Settings の X アカウント OAuth でも使える。

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | kie.ai API キー。Settings 保存キーがあればそちらが優先 |
| `PORT` | API ポート（既定 `8787`） |
| `STUDIO_DB_PATH` | SQLite パス。デスクトップは userData に自動設定。dev は `data/studio.db` |
| `RELEASE_BASE_URL` | デスクトップ差分更新の静的ホスト。未設定ならスキップ |
| `XAI_API_KEY` | 任意。Grok CLI 最適化と、エージェント組み込み xai |
| `SYNC_MODELS_ON_START` | `0` で起動時同期を無効化 |
| `SYNC_MODELS_FORCE` | `1` で強制同期 |
| `SYNC_CONCURRENCY` | 同期並列数（既定 12、最大 32） |

デスクトップは起動時に `STUDIO_CATALOG_PATH` / `FLUE_DB_PATH` / `STUDIO_AGENT_TOKEN` もセットする。

## よく使うコマンド

```bash
npm run dev
npm run dev:server
npm run desktop:dev
npm test
npm run lint
npm run build
npm run sync:models
npm run sync:models -- --force
npm run kiestudio -- --help
```

起動時同期は既存カタログが古い場合だけ実行し、失敗時も既存カタログで起動を続ける。

## CLI

`kiestudio` は起動中の Studio API のクライアント。詳細は [CLI](wiki://cli)。

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
- [CLI](wiki://cli)
