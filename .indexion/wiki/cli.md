# CLI

`kiestudio` は起動中の Studio API のクライアント。kie.ai や `/api/internal/agent/*` は直接叩かない。生成結果は同じ SQLite 履歴に載り、Gallery でピン・再利用・リトライできる。削除コマンドは無い。

実装は `cli/`（エントリ `cli/index.ts`）。実行は `bun cli/index.ts`、`npm run kiestudio`、または `npx kiestudio`。

## 前提

- `KIE_API_KEY`（`.env` または設定画面）
- Studio API が起動していること

接続先は `STUDIO_API_BASE`。未設定時は `127.0.0.1:8787-8806` の `GET /api/health` を探索する。

```bash
kiestudio up          # API のみ（既に起動中なら何もしない）
npm run dev           # API + Web + agent
```

## コマンド

| コマンド | 役割 |
|----------|------|
| `up` | Hono API を前面起動。health が応答していれば何もしない |
| `open` | Web UI（`http://localhost:5173`）を開く |
| `models` | カタログ workflow を一覧。`--category` とクエリで絞る |
| `generate` | タスク作成。毎回新しい `taskId`（冪等ではない） |
| `status` | タスク状態。`--wait` で終端までポーリング |
| `history` | Gallery 履歴の要約 |

機械可読出力は `--json`。サブコマンドごとに `--help`（Examples 付き）。

```bash
kiestudio models --category image flux
kiestudio generate -m flux-kontext-pro -p "a red bicycle" --wait
kiestudio generate -m flux-kontext-pro -p "hi" --set aspect_ratio=16:9 --json
kiestudio status <taskId> --wait
kiestudio history bicycle
kiestudio open
```

## Gallery

`generate` はサーバー側で履歴へ upsert する。ウィンドウフォーカス時に Gallery が `GET /api/history` を merge するため、見えないときは Studio をフォーカスする。ピン・再利用・削除は UI 側。

## See Also

- [Getting Started](wiki://getting-started)
- [Server API](wiki://server-api)
- [Core Concepts](wiki://core-concepts)
- [Frontend](wiki://frontend)
- [Architecture](wiki://architecture)
