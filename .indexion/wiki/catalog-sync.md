# Catalog Sync

docs.kie.ai の Market IMAGE/VIDEO ページから OpenAPI を抽出し、`src/data/catalog.json` を再生成する。

## 入口

| 入口 | 説明 |
|------|------|
| `server/catalog/sync.ts` | 同期本体（サーバー起動時も利用） |
| `scripts/sync-models.ts` | `npm run sync:models` CLI |
| `src/lib/models/from-openapi.ts` | Markdown/OpenAPI → `FieldSchema` |

## 処理概要

1. `https://docs.kie.ai/llms.txt` からリンク一覧を取得
2. `/market/` かつ除外パターン外のページを対象にする
3. 各ページから OpenAPI を抽出 → モデル slug / category / fields
4. `src/data/catalog.json` に書き出し

除外例: suno / music / chat / file-upload / webhook など（`EXCLUDE_RE`）。

## スキップ条件

カタログが十分新しい場合はフル同期しない。起動時の無駄な再取得を避ける設計なので、毎回フル同期する変更は入れない。

環境変数:

- `SYNC_MODELS_ON_START=0` — 起動同期オフ
- `SYNC_MODELS_FORCE=1` — 強制同期
- `SYNC_CONCURRENCY` — ページ取得並列（既定 12、最大 32）

## 出力

`Catalog`（`syncedAt` / `source` / `models: ModelDefinition[]`）。

フロントの `GET /api/models` と UI の DynamicForm がこれを読む。

## See Also

- [Getting Started](wiki://getting-started)
- [Core Concepts](wiki://core-concepts)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
