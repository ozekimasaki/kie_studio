# Agent Mode

Hono 同一プロセスの Studio エージェント。Vercel AI SDK（`streamText` + `@ai-sdk/react` `useChat`）で LLM と会話しながら IMAGE / VIDEO / AUDIO を生成する。Flue sidecar / embed は使わない。

## 構成

```text
Frontend (Vite :5173)
  Studio | エージェント セグメントトグル (FloatingChrome)
  AgentView / AgentChat → useChat → POST /api/agent/chat
        │
        ▼
  Hono (:8787)  同一 Bun.serve
    server/agent/chat.ts     streamText + tools
    server/agent/resolveModel.ts
    server/agent/actions.ts  catalog / adapter / DB を直接呼ぶ
    studio.db                agent_conversations.messages_json
```

デスクトップ（Electrobun）でも同じ Hono がチャットを処理する。`/agents/*` プロキシも `Resources/agent-server` 同梱も無い。Windows の bun エントリは `%TEMP%/electrobun-*.js` の Worker として動くため、起動時に `%LocalAppData%\ai.kie.studio\<ch>\app\bin` へ `chdir` して Electrobun の `version.json` を読めるようにする（`src/bun/installCwd.ts`）。これはエージェント実装とは独立したホスト修正。

## サーバー（`server/agent/`）

| ファイル | 役割 |
|----------|------|
| `systemPrompt.ts` | 日本語システムプロンプト |
| `resolveModel.ts` | builtin / `custom-*` / Grok OAuth を LanguageModel に解決 |
| `tools.ts` | AI SDK `tool()`（ハイフン名） |
| `actions.ts` | workflows / generate / task / history / credits / optimize |
| `chat.ts` | `createUIMessageStream` + `streamText`。会話が無ければ upsert |
| `routes/agentChat.ts` | `GET /api/agent/health`、`GET /api/agent-conversations/:id/messages`、`POST /api/agent/chat` |

### ツール

| ツール | 役割 |
|--------|------|
| `list-workflows` / `get-workflow-schema` | 生成前の候補・入力確認 |
| `generate-media` / `get-task-status` | 非同期生成 + 状態 |
| `search-history` / `get-task-input` | 履歴検索・入力復元 |
| `get-credit-balance` / `optimize-prompt` | 残高・プロンプト最適化 |

`generate-media` は `data-media-task` パートを送り、チャット内カードが submitted → succeeded/failed と遷移する。履歴はサーバー側 upsert で通常ギャラリーにも載る。loopback の `/api/internal/agent/*` は使わない（デバッグ用に残置）。

## Grok（X アカウント OAuth）

エージェントで Grok を使う経路はふたつ（併存）:

1. 組み込み `xai` + `XAI_API_KEY`（Settings のキー、または env）
2. **X アカウント OAuth**（Settings → LLM →「X アカウントでログイン」）

OAuth は `server/grokOauth/` に同梱（[grok-oauth-proxy](https://github.com/ozekimasaki/grok-oauth-proxy) 由来、MIT）。別ポートは立てず、Studio Hono の `/api/grok-oauth/v1/*` が OpenAI 互換プロキシになる。ログイン済みなら credentials / settings にシステムエンドポイント `grok-oauth`（label: Grok (X アカウント)）が注入され、モデルピッカーから選べる。解決時の `baseURL` は `STUDIO_API_BASE/api/grok-oauth/v1`（同一プロセスへの HTTP）。

| 項目 | 内容 |
|------|------|
| トークン | `auth.json`（dev: `data/grok-oauth/`、desktop: userData/`grok-oauth`）。コミット禁止 |
| ログイン API | `GET/POST /api/settings/grok-oauth*`（device-code、クライアントが poll） |
| プロキシ | `ALL /api/grok-oauth/v1/*` → `https://api.x.ai/v1` |
| 注意 | 非公式 OAuth。SuperGrok / Premium+ で API アクセスが必要。403 時は公式キーを使う |

`server/grok/`（Grok CLI プロンプト最適化）とは別モジュール。

## フロント

- `src/components/agent/` — AgentView、チャット、メディアタスクカード、モデルピッカー
- `src/lib/agentApi.ts` — `agentChatUrl()`（`/api/agent/chat`）、`fetchAgentHealth`（`/api/agent/health`）、会話 CRUD、メッセージ hydrate
- `src/components/LlmSettingsSection.tsx` — Settings の LLM キー / X OAuth / カスタムエンドポイント / 既定モデル
- `src/components/shell/StudioModeToggle.tsx` — Studio ↔ エージェント切替

### 会話のライフサイクル（遅延作成）

「会話を開始」時点ではローカル **draft**（`AgentView` state。非永続・リクエスト無し）を作るだけ。

| タイミング | 起きること |
|------------|-----------|
| 会話を開始 | draft 生成のみ。`agent_conversations` に触れない |
| 初回メッセージ送信 | `useChat` の `sendMessage` → `POST /api/agent/chat`（サーバーが会話 upsert + `messages_json` 保存）→ 成功後に `POST /api/agent-conversations` でメタデータ永続化（タイトルは本文先頭 32 文字） |
| 2 通目以降 | 同じ `sendMessage` |

draft 中の `AgentChat` は履歴 GET をしない。送信失敗時は入力を復元し、永続化コールバックを呼ばない。既存会話を開いた場合は `GET /api/agent-conversations/:id/messages` で hydrate する。

旧 Flue（`flue.db`）の本文は移行しない。メタデータだけ残った会話は空チャット時に案内を出す。

## サーバー API

- `/api/settings/llm*` — LLM キー保管（AES-256-GCM、`app_settings`）
- `/api/settings/grok-oauth*` — X OAuth ログイン状態・device-code・logout
- `/api/grok-oauth/v1/*` — OAuth Bearer の OpenAI 互換プロキシ
- `/api/agent/health` — Hono が生きていれば `{ ok: true }`。502 は API プロセス自体が落ちているときだけ
- `/api/agent/chat` — UI message stream（`conversationId` / `provider` / `model` / `messages`）
- `/api/agent-conversations` — 会話メタデータ CRUD
- `/api/agent-conversations/:id/messages` — `messages_json`
- `/api/internal/agent/*` — 旧内部 API（トークン必須）。現行エージェントは使わない

### エージェント不通時の見え方

チャットは `/api`（:8787）だけを使う。`GET /api/agent/health` が失敗するのは Hono が落ちているときに限る。旧 `GET /agents/health` の 502（Flue embed / sidecar 未到達）は発生しない。

LLM キー不足は `POST /api/agent/chat` が 400 で `{ error }` を返す。送信失敗時は入力を復元する。

## コマンド

| コマンド | 用途 |
|----------|------|
| `npm run dev` | server + web（エージェントは :8787 に含まれる） |
| `npm run desktop:build:canary` | フロント + Electrobun。別途エージェントビルドは不要 |

リリース前チェックは [docs/PRE_RELEASE.md](../../docs/PRE_RELEASE.md)。

## See Also

- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Server API](wiki://server-api)
