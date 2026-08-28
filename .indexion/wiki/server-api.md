# Server API

Hono エントリは `server/index.ts`（`createApp()` は `server/app.ts`）。`127.0.0.1:8787` で待受し、API key はサーバーだけが保持する。デスクトップでは Electrobun メインが同じプロセスで Hono を起動する。エージェントチャットもこのプロセス内（`POST /api/agent/chat`）。

## 主要ルート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/models?category=` | Market catalog と専用 workflow を統合 |
| POST | `/api/upload` | 一意名で Upload API へ転送。音源は素材棚へ登録 |
| GET/DELETE | `/api/audio-assets[/:id]` | 外部音源素材棚 |
| POST | `/api/generate` | provider / operation adapter で作成し、履歴へ upsert。Market は既定 |
| GET | `/api/task` | provider / operation ごとの状態を正規化し、終端は履歴へ mirror |
| POST | `/api/suno/timestamped-lyrics` | alignedWords / waveformData |
| POST | `/api/suno/style` | music style 補助 |
| POST | `/api/suno/persona` | Persona 作成と保存 |
| GET/DELETE | `/api/personas[/:id]` | Persona 素材棚 |
| POST | `/api/archive` | 複数 media と lyrics を ZIP streaming |
| GET | `/api/history` | SQLite 履歴一覧 |
| PUT | `/api/history` | 履歴 upsert（未知の taskId は消さない。終端を pending で上書きしない） |
| DELETE | `/api/history/:taskId` | 1 件削除 |
| POST | `/api/history/clear-unpinned` | 未ピンを削除 |
| POST | `/api/history/import` | JSON merge |
| POST | `/api/history/migrate` | 旧 localStorage 移行 |
| GET | `/api/credits` | 残高 |
| POST | `/api/download-url` | 一時 download URL |
| GET/PUT/DELETE | `/api/settings/llm*` | LLM API キー・カスタムエンドポイント・既定モデル |
| GET | `/api/agent/health` | エージェントランタイム（Hono 生存確認） |
| POST | `/api/agent/chat` | AI SDK UI message stream。任意の `agentRunMode`（`plan` \| `agent`、省略時 `agent`）。`generate-media` は tool approval 待ち |
| GET/POST/PATCH/DELETE | `/api/agent-conversations` | エージェント会話メタデータ |
| GET | `/api/agent-conversations/:id/messages` | 保存済みチャット本文 |
| * | `/api/internal/agent/*` | 旧内部 API（`x-studio-agent-token` 必須）。現行チャットは使わない |

## 内部エージェント API

トークンは `STUDIO_AGENT_TOKEN`（未設定時は開発用既定値）。デスクトップは起動毎に UUID を発行する。

| Path | 説明 |
|------|------|
| `/internal/agent/credentials` | 復号済み LLM キー + カスタムエンドポイント |
| `/internal/agent/workflows` | キュレーション済み workflow 一覧 |
| `/internal/agent/workflows/:id/schema` | 入力スキーマ |
| `/internal/agent/generate` | adapter create + 履歴 upsert → `{ taskId }` |
| `/internal/agent/task` | 正規化タスク状態 |
| `/internal/agent/history` | 履歴検索 |
| `/internal/agent/history/:taskId/input` | 入力復元 |
| `/internal/agent/credits` | 残高 |

## DB

`data/studio.db`（デスクトップは `STUDIO_DB_PATH`）に `history_items`、`saved_personas`、`saved_audio_assets`、`agent_conversations`、`app_settings` を持つ。履歴スキーマは provider、operation、parent、media、raw param/result を additive migration で追加する。エージェント本文は `agent_conversations.messages_json`（additive）。`app_settings.agent_tool_approval_secret` は生成認可 HMAC。メディア本体は保存しない。旧 `flue.db` は読まない。

## エラー

`KieApiError` は `{ error, code }` と適切な status に変換する。Malformed JSON は 400。polling 側の upstream error はフロント履歴にも診断として残す。

## See Also

- [Architecture](wiki://architecture)
- [Kie Integration](wiki://kie-integration)
- [Catalog Sync](wiki://catalog-sync)
- [Agent Mode](wiki://agent-mode)
