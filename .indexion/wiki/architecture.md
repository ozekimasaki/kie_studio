# Architecture

## レイヤ構成

```text
Browser (Vite :5173)
  App / components / lib
    ├─ SubmissionQueue (20 requests / 10 seconds)
    ├─ AudioPlayerProvider (single persistent player)
    └─ fetch('/api/...')
             │
             ▼
Hono (:8787)
  ├─ routes/*          HTTP boundary
  ├─ kie/adapters/*    Market / Suno / Veo / Runway normalization
  ├─ db/*              history / personas / audio assets
  ├─ catalog/*         docs + dedicated workflows
  └─ grok/*            prompt optimization
```

`KIE_API_KEY` は Hono 側のみ。フロントは相対 `/api` だけを呼ぶ。

## パッケージ責務

| パス | 役割 |
|------|------|
| `src/App.tsx` | フォーム、キュー、履歴、ポーリング、Quick Action の調停 |
| `src/components/audio/` | 会話・ナレーション編集と常駐プレイヤー |
| `src/components/History*` | 複数メディア、同期歌詞、Before/After、API 詳細 |
| `src/lib/` | API、型、履歴、キュー、検証、親子関係 |
| `server/kie/adapters/` | provider 差分の正規化 |
| `server/db/` | 加算マイグレーションを行う SQLite |
| `server/catalog/` | Market カタログと専用 workflow の統合 |
| `server/routes/archive.ts` | 一時 URL から ZIP をストリーミング |

## 拡張ポイント

- provider 追加: `ProviderAdapter` を実装し adapter registry へ登録
- workflow 追加: `server/catalog/dedicated.ts`。Market schema は同期カタログを優先して UI メタデータだけ上書き
- 特殊 UI: `FieldType` / `DynamicForm` / workflow validation を一連で更新
- DB 変更: `server/db/open.ts` の加算マイグレーションを使う

## See Also

- [Core Concepts](wiki://core-concepts)
- [Server API](wiki://server-api)
- [Kie Integration](wiki://kie-integration)
- [Frontend](wiki://frontend)
