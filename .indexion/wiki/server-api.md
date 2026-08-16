# Server API

Hono エントリは `server/index.ts`（`createApp()` は `server/app.ts`）。`127.0.0.1:8787` で待受し、API key はサーバーだけが保持する。デスクトップでは Electrobun メインが同じプロセスで Hono を起動し、`/agents/*` は埋め込み Flue へ転送する。

## 主要ルート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/health` | ヘルス、キー有無、デスクトップ判定、version |
| GET | `/api/models?category=` | Market catalog と専用 workflow を統合 |
| POST | `/api/upload` | 一意名で Upload API へ転送。音源は素材棚へ登録 |
| GET/DELETE | `/api/audio-assets[/:id]` | 外部音源素材棚 |
| POST | `/api/generate` | provider / operation adapter で作成し、履歴へ upsert。Market は既定 |
| GET | `/api/task` | provider / operation ごとの状態を正規化し、終端は履歴へ mirror。成功時はローカルアーカイブを起動 |
| POST | `/api/suno/timestamped-lyrics` | alignedWords / waveformData |
| POST | `/api/suno/style` | music style 補助 |
| POST | `/api/suno/persona` | Persona 作成と保存 |
| GET/DELETE | `/api/personas[/:id]` | Persona 素材棚 |
| POST | `/api/archive` | 複数 media と lyrics を ZIP streaming |
| GET | `/api/history` | SQLite 履歴一覧 |
| PUT | `/api/history` | 履歴 upsert（未知の taskId は消さない。終端を pending で上書きしない。`localPath` はサーバー管理値を保持） |
| DELETE | `/api/history/:taskId` | 1 件削除 |
| POST | `/api/history/clear-unpinned` | 未ピンを削除 |
| POST | `/api/history/import` | JSON merge |
| POST | `/api/history/migrate` | 旧 localStorage 移行 |
| GET | `/api/credits` | 残高 |
| POST | `/api/download-url` | 一時 download URL |
| GET | `/api/grok/status` | Grok CLI 利用可否 |
| GET | `/api/optimize-profile` | モデル別最適化プロファイル |
| POST | `/api/optimize-prompt` | プロンプト最適化 / 生成（Grok CLI。未導入時 503） |
| GET | `/api/settings` | KIE API キー保存状態（マスク表示） |
| PUT/DELETE | `/api/settings/api-key` | API キーの SQLite 保存 / 削除 |
| POST | `/api/settings/open-media-folder` | ローカル `media/` を OS のファイルマネージャで開く |
| GET/PUT/DELETE | `/api/settings/llm*` | LLM API キー・カスタムエンドポイント・既定 / 優先モデル |
| GET/POST | `/api/settings/grok-oauth*` | X OAuth 状態・device-code・logout |
| ALL | `/api/grok-oauth/v1/*` | OAuth Bearer の OpenAI 互換プロキシ |
| GET/POST/PATCH/DELETE | `/api/agent-conversations` | エージェント会話メタデータ |
| POST | `/api/update/check` | デスクトップ差分更新。dev / Web は 503 |
| POST | `/api/media/backfill` | `localPath` 未設定の履歴を再アーカイブ |
| GET | `/media/*` | ローカル保存メディアの配信（path traversal 防止） |
| * | `/api/internal/agent/*` | Flue エージェント専用（`x-studio-agent-token` 必須） |

## 内部エージェント API

トークンは `STUDIO_AGENT_TOKEN`（未設定時は開発用既定値）。デスクトップは起動毎に UUID を発行する。

| Path | 説明 |
|------|------|
| `/internal/agent/credentials` | 復号済み LLM キー + カスタムエンドポイント（OAuth システムエンドポイントを注入） |
| `/internal/agent/workflows` | キュレーション済み workflow 一覧 |
| `/internal/agent/workflow-schema?id=` | 入力スキーマ |
| `/internal/agent/generate` | adapter create + 履歴 upsert → `{ taskId }` |
| `/internal/agent/task` | 正規化タスク状態。成功時はローカルアーカイブ |
| `/internal/agent/history` | 履歴検索 |
| `/internal/agent/history/:taskId/input` | 入力復元 |
| `/internal/agent/credits` | 残高 |

プロンプト最適化ツールは内部 API ではなく公開 `POST /api/optimize-prompt` を呼ぶ。

## DB / ローカルファイル

`data/studio.db`（デスクトップは `STUDIO_DB_PATH`）に `history_items`、`saved_personas`、`saved_audio_assets`、`agent_conversations`、`app_settings` を持つ。履歴スキーマは provider、operation、parent、media、raw param/result を additive migration で追加する。Flue 会話本体は別 DB（`FLUE_DB_PATH` / `flue.db`）。

生成メディアは DB 隣の `media/{taskId}/` に保存し、`MediaAsset.localPath` で参照する。Persona / 外部音源はメタデータのみ。Grok OAuth トークンは `data/grok-oauth/auth.json`（デスクトップは userData/`grok-oauth`）。コミット禁止。

## エラー

`KieApiError` は `{ error, code }` と適切な status に変換する。Malformed JSON は 400。polling 側の upstream error はフロント履歴にも診断として残す。`KIE_API_KEY` 未設定の generate は 503。

## See Also

- [Architecture](wiki://architecture)
- [Kie Integration](wiki://kie-integration)
- [Catalog Sync](wiki://catalog-sync)
- [Agent Mode](wiki://agent-mode)
- [Prompt Optimize](wiki://prompt-optimize)
- [CLI](wiki://cli)
