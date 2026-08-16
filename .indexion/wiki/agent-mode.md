# Agent Mode

Flue 基盤の Studio エージェント。LLM と会話しながら IMAGE / VIDEO / AUDIO を生成する。

## 構成

```text
Frontend (Vite :5173)
  Studio | エージェント セグメントトグル (FloatingChrome)
  AgentView / useFlueAgent → /agents/studio/<convId>
        │                          │
        ▼                          ▼
  /api (Hono :8787)          Flue sidecar (:8789 Node, dev)
                                   │
                                   ▼ loopback + x-studio-agent-token
                             /api/internal/agent/*
```

デスクトップ（Electrobun）では `agent/dist/app.mjs` を `Resources/agent-server` として同梱し `loadFlueNodeApplication` で埋め込む。同じ Bun.serve が `/agents/*` を転送する。Electrobun は asar 後に `Resources/app` を削除するため、`postBuild` で `Resources/agent-server` へ退避する（`asarUnpack` だけではインストーラーに残らない）。見つからない場合は `app.asar` から userData/`agent-server` へ展開する。`FLUE_DB_PATH` は userData の `flue.db`（`studio.db` と同階層。アンインストールで親 dir を消さない）。

## エージェント (`agent/`)

- `src/agents/studio.ts` — `'use agent'` + ツール群
- `src/providers.ts` — Google / xAI / OpenAI / Anthropic / Alibaba / カスタムエンドポイント。キーは内部 API から `resolve()`
- `src/kieClient.ts` — `STUDIO_API_BASE` + `STUDIO_AGENT_TOKEN`
- `vite.config.ts` — `node:sqlite` → Bun 互換 shim 書換、`ssr.noExternal` で自己完結 dist

### ツール

| ツール | 役割 |
|--------|------|
| `list-workflows` / `get-workflow-schema` | 生成前の候補・入力確認 |
| `generate-media` / `get-task-status` | 非同期生成 + 状態 |
| `search-history` / `get-task-input` | 履歴検索・入力復元 |
| `get-credit-balance` / `optimize-prompt` | 残高・プロンプト最適化 |

`generate-media` は `data-media-task` パートを送り、チャット内カードが submitted → succeeded/failed と遷移する。履歴はサーバー側 upsert で通常ギャラリーにも載る。

## Grok（X アカウント OAuth）

エージェントで Grok を使う経路はふたつ（併存）:

1. 組み込み `xai` + `XAI_API_KEY`（Settings のキー、または env）
2. **X アカウント OAuth**（Settings → LLM →「X アカウントでログイン」）

OAuth は `server/grokOauth/` に同梱（[grok-oauth-proxy](https://github.com/ozekimasaki/grok-oauth-proxy) 由来、MIT）。別ポートは立てず、Studio Hono の `/api/grok-oauth/v1/*` が OpenAI 互換プロキシになる。ログイン済みなら credentials / settings にシステムエンドポイント `grok-oauth`（label: Grok (X アカウント)）が注入され、モデルピッカーから選べる。

| 項目 | 内容 |
|------|------|
| トークン | `auth.json`（dev: `data/grok-oauth/`、desktop: userData/`grok-oauth`）。コミット禁止 |
| ログイン API | `GET/POST /api/settings/grok-oauth*`（device-code、クライアントが poll） |
| プロキシ | `ALL /api/grok-oauth/v1/*` → `https://api.x.ai/v1` |
| 注意 | 非公式 OAuth。SuperGrok / Premium+ で API アクセスが必要。403 時は公式キーを使う |

`server/grok/`（Grok CLI プロンプト最適化）とは別モジュール。

## フロント

- `src/components/agent/` — AgentView、チャット、メディアタスクカード、モデルピッカー
- `src/components/LlmSettingsSection.tsx` — Settings の LLM キー / X OAuth / カスタムエンドポイント / 既定モデル
- `src/components/shell/StudioModeToggle.tsx` — Studio ↔ エージェント切替

### 会話のライフサイクル（遅延作成）

「会話を開始」時点ではローカル **draft**（`AgentView` state。非永続・リクエスト無し）を作るだけ。

| タイミング | 起きること |
|------------|-----------|
| 会話を開始 | draft 生成のみ。`agent_conversations` にも Flue にも触れない |
| 初回メッセージ送信 | ① `client.send`（`initialData` に provider/model）で Flue インスタンス生成 → ② observation を有効化（履歴 hydrate + SSE follow）→ ③ `POST /api/agent-conversations` でメタデータ永続化（タイトルは本文先頭 32 文字） |
| 2 通目以降 | `agent.sendMessage`（session 経由、optimistic 表示） |

draft 中の `AgentChat` は `useFlueAgent` を dormant（client 未注入）に保ち、履歴 GET / SSE を一切張らない。送信失敗時は draft に戻り何も残らない。既存会話を開いた場合は従来通りマウント時に observe 開始。

## サーバー

- `/api/settings/llm*` — LLM キー保管（AES-256-GCM、`app_settings`）
- `/api/settings/grok-oauth*` — X OAuth ログイン状態・device-code・logout
- `/api/grok-oauth/v1/*` — OAuth Bearer の OpenAI 互換プロキシ
- `/api/internal/agent/*` — エージェント専用内部 API（トークン必須）。credentials に OAuth システムエンドポイントを注入
- `/api/agent-conversations` — 会話メタデータ CRUD（`agent_conversations` テーブル）

### エージェント不通時の見え方

Flue の `send()` は LLM を呼ぶ前に HTTP 202 で受付する。したがって送信直後の失敗は **Grok / X OAuth の応答ではなく**、`POST /agents/studio/:id` が Flue に届いていない。原因は (1) インストーラー版で embed（`Resources/agent-server`）が無い (2) 開発時に sidecar `:8789` 未起動、または Vite の `/agents` プロキシが ECONNREFUSED。Settings の X ログインは `/api`（:8787）なので成功しても、エージェント送信は embed / sidecar を使う。

`GET /agents/health` で到達性を見る。不通なら AgentView が送信前に警告する。502 本文は Flue の error envelope（`type: agent_unavailable`）にし、SDK が `request failed` に潰さない。sidecar プロキシは起動レース向けに短く再試行する。インストーラー版で embed が無いときは sidecar（:8789）へは飛ばず、再起動を案内する。

既存会話の observe() は指数バックオフ（1s→2s→…→30s 上限）で自動再試行する。draft は observe しないので、初回送信の 502 が唯一の兆候だった（入力は復元する）。

## コマンド

| コマンド | 用途 |
|----------|------|
| `npm run dev` | server + web + agent sidecar |
| `npm run agent:build` | `agent/dist`（desktop 同梱前に必須） |
| `npm run desktop:build:canary` | agent:build を含むフルビルド |

リリース前チェックは [docs/PRE_RELEASE.md](../../docs/PRE_RELEASE.md)。

## See Also

- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Server API](wiki://server-api)
