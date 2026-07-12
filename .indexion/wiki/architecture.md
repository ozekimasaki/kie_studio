# Architecture

## レイヤ構成

```text
Browser (Vite :5173)
  src/App.tsx + components (+ shell/motion) + lib
        │  fetch('/api/...')
        ▼
Vite proxy  /api  ──►  Hono server (:8787)
                         │
                         ├─ routes/*   HTTP 境界
                         ├─ db/*       SQLite（履歴ギャラリー）
                         ├─ kie/*      kie.ai Market / Upload
                         ├─ grok/*     Grok CLI プロンプト最適化
                         └─ catalog/*  docs → catalog.json 同期
```

秘密情報（`KIE_API_KEY`）は Hono 側のみ。フロントの `src/lib/api.ts` は相対パス `/api` のみ呼ぶ。

作業前のオリエンテーションは `AGENTS.md` の indexion 手順（wiki → `agent orient`）に従う。

## パッケージ責務

| パス | 役割 |
|------|------|
| `src/App.tsx` | 生成・履歴ポーリングのオーケストレーション |
| `src/components/` | UI（フォーム・履歴・最適化） |
| `src/components/shell/` | StudioShell / FloatingChrome |
| `src/components/motion/` + `src/lib/motion.ts` | インタラクション / モーション |
| `src/lib/` | API・履歴純粋関数・モデル型・メンション |
| `src/data/catalog.json` | 同期済みモデルカタログ |
| `server/routes/` | Hono ルート |
| `server/db/` | SQLite（`data/studio.db`・履歴） |
| `server/kie/` | kie.ai クライアント |
| `server/grok/` | プロンプト最適化 |
| `server/catalog/` | カタログ同期 |
| `scripts/` | CLI（`sync-models`） |
| `.indexion/wiki/` | プロジェクト知識ベース |

## 拡張ポイント

- **新モデル対応**: カタログ同期が OpenAPI からフィールドを抽出。特殊 UI が必要なら `FieldType` / `DynamicForm` を拡張
- **新 API ルート**: `server/routes/` に追加し `server/index.ts` で `app.route`
- **最適化プロファイル**: `server/grok/optimize-profiles.ts` にモデル別ルール

## エラー境界

`KieApiError` は `server/index.ts` の `onError` で HTTP ステータスにマップして JSON `{ error, code }` を返す。

## See Also

- [Overview](wiki://overview)
- [Getting Started](wiki://getting-started)
- [Server API](wiki://server-api)
- [Kie Integration](wiki://kie-integration)
- [Frontend](wiki://frontend)
