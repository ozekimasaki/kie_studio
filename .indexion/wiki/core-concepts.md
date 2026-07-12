# Core Concepts

## データフロー（生成）

```text
UI (DynamicForm)
  → POST /api/generate
  → server/kie createTask
  → taskId を履歴に保存（SQLite）
    → GET /api/task でポーリング
  → resultJson / 失敗情報を HistoryGallery に反映
```

Reference がある場合は先に `POST /api/upload` → 返却 URL をフォーム値・プロンプトメンションに載せる。

## Catalog / ModelDefinition

`src/data/catalog.json` がモデル一覧と各モデルの `fields`（動的フォーム定義）のソース。

主要型（`src/lib/models/types.ts`）:

- `ModelCategory`: `image` | `video`
- `FieldSchema`: フィールド型・enum・reference・kling_elements など
- `MentionStyle`: プロンプトへの参照挿入方式（`at-image` 等）
- `HistoryItem` / `NormalizedTask`: ローカル履歴と API タスク状態

## Dynamic Form

カタログの OpenAPI 由来スキーマから UI を生成する。

- `reference` + `scalar`: UI は配列、API には先頭 URL 文字列
- Seedance / Kling 系はメンションタグ・キー名の表記ゆれに敏感（末尾スペース含む）

## History（SQLite）

永続化は Hono 側の `data/studio.db`（`server/db/`）。フロントは `/api/history` 経由。

- 非ピン上限 200・ピン上限 30。ピンは非ピン予算を消費しない
- メタデータと URL のみ（生成メディア本体は保存しない）
- 初回起動時に旧 `localStorage`（`kie-studio-history`）を `POST /api/history/migrate` で移行
- インポート時は正規化（タイムスタンプ秒/ミリ秒、不正データ除去、非 terminal → unknown）
- 再試行・入力復元は未知キーを破棄して安全にマージ
- cap / normalize の純粋関数は `src/lib/history.ts`（サーバーも共有）

## Mentions / Kling Elements

- プロンプト内の `@参照` 挿入（モデル別 `mentionStyle`）
- Kling Elements 専用エディタ（名前・説明・入力 URL・音声・時間範囲）

## See Also

- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
- [Catalog Sync](wiki://catalog-sync)
