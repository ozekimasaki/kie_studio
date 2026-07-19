# Overview

kie.ai の **IMAGE / VIDEO / AUDIO** を、モデル名ではなく「やりたいこと」から試すローカル Studio。

API キーはサーバー側（`.env` の `KIE_API_KEY`）だけに置き、フロントへは渡さない。エージェント向け手順は `AGENTS.md`、設計知識はこの wiki を正とする。

## 何ができるか

- Market / Suno / Veo / Runway を共通タスクとして生成・ポーリング
- 用途・提供元・お気に入り・最近使用で絞れるモデルピッカー
- 画像・動画・音声のアップロード、送信前制約チェック、参照メンション
- AUDIO: 楽曲、会話、ナレーション、音声処理、同期歌詞、波形、Persona、区間編集
- VIDEO: Aleph、延長、高画質化、リップシンクの Quick Action
- SQLite 履歴、親子タスク、複数メディア、部分成功、元レスポンス診断
- ローカル送信キュー、期限表示、生成グループの ZIP 保存

チャット系エンドポイントと、DAW 寄りの stem / MIDI / Music Video は対象外。

## 技術スタック

| 層 | 技術 |
|----|------|
| Frontend | Vite + React 19 + Tailwind CSS v4 + TanStack Query + Motion |
| Backend | Hono（`127.0.0.1:8787`） |
| Storage | SQLite（履歴・Persona・外部音源メタデータ） |
| Catalog | docs OpenAPI + 専用 API workflow 定義 |

## See Also

- [Getting Started](wiki://getting-started)
- [Architecture](wiki://architecture)
- [Core Concepts](wiki://core-concepts)
