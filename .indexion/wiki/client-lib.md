# Client Lib

フロント共有ロジック（`src/lib/`）。

## モジュール

| ファイル | 役割 |
|----------|------|
| `api.ts` | `/api` クライアント（models / generate / task / upload / credits / optimize / history） |
| `history.ts` | 履歴の純粋関数（cap・ピン・マージ・JSON 入出力・正規化）。永続化は持たない |
| `media.ts` / `mediaExpiry.ts` | URL 種別判定・期限まわり |
| `snippets.ts` | プロンプトスニペット（localStorage） |
| `motion.ts` | モーション設定 |
| `models/types.ts` | Catalog / FieldSchema / HistoryItem 等の型 |
| `models/from-openapi.ts` | docs OpenAPI → フィールド抽出（同期でも共有） |
| `models/mentions.ts` | メンション挿入ヘルパ |

## API クライアント規約

- すべて相対パス `/api/...`（Vite プロキシ前提）
- 失敗時はレスポンス JSON の `error` を `Error` メッセージに載せる
- 型は `models/types.ts` から再エクスポート

## 履歴の注意点

- 永続化は `fetchHistory` / `putHistory` / `importHistoryApi` / `migrateHistory`（`api.ts`）
- ピン上限・非ピン上限を維持すること（`MAX_PINNED` / `MAX_ITEMS`）
- インポート正規化と入力復元の安全策を壊さないこと
- タイムスタンプは秒/ミリ秒の両方を許容（`normalizeTimestamp`）

## See Also

- [Frontend](wiki://frontend)
- [Core Concepts](wiki://core-concepts)
- [Server API](wiki://server-api)
- [Catalog Sync](wiki://catalog-sync)
