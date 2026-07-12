# Server API

Hono エントリ: `server/index.ts`。ホスト `127.0.0.1`、既定ポート `8787`。

CORS は Vite 開発オリジン（`localhost:5173` / `127.0.0.1:5173`）のみ許可。

## ルート一覧

| Method | Path | 実装 | 説明 |
|--------|------|------|------|
| GET | `/api/health` | `index.ts` | ヘルス・API キー有無 |
| GET | `/api/models` | `routes/models.ts` | カタログ（`?category=`） |
| POST | `/api/upload` | `routes/upload.ts` | File Upload API へ転送 |
| POST | `/api/generate` | `routes/generate.ts` | Market `createTask` |
| GET | `/api/task` | `routes/task.ts` | `recordInfo` |
| GET | `/api/credits` | `routes/credits.ts` | 残クレジット |
| POST | `/api/download-url` | `routes/download-url.ts` | 一時 DL URL |
| GET | `/api/history` | `routes/history.ts` | ギャラリー履歴一覧（SQLite） |
| PUT | `/api/history` | `routes/history.ts` | 履歴全置換（サーバーで cap） |
| POST | `/api/history/import` | `routes/history.ts` | JSON インポート merge |
| POST | `/api/history/migrate` | `routes/history.ts` | localStorage からの初回移行 |
| * | optimize / grok status | `routes/optimize-prompt.ts` | プロンプト最適化 |

## 履歴 DB

- ファイル: `data/studio.db`（gitignore）
- 実装: `server/db/open.ts` + `server/db/history.ts`（`better-sqlite3`）
- スキーマ: `history_items`（メタデータ＋URL JSON。メディア本体は保存しない）
- cap / normalize は `src/lib/history.ts` をサーバーから共有

## 起動時カタログ同期

`serve` コールバック内で非同期に `syncCatalog` を実行する。

- 既定: カタログが新しければスキップ
- `SYNC_MODELS_ON_START=0` で無効
- `SYNC_MODELS_FORCE=1` で強制

失敗しても既存 `catalog.json` で起動を継続する。起動時に SQLite も開く。

## エラー処理

`KieApiError` を検知して適切な HTTP ステータスと `{ error, code }` を返す。それ以外は 500。

## See Also

- [Architecture](wiki://architecture)
- [Core Concepts](wiki://core-concepts)
- [Kie Integration](wiki://kie-integration)
- [Catalog Sync](wiki://catalog-sync)
- [Prompt Optimize](wiki://prompt-optimize)
