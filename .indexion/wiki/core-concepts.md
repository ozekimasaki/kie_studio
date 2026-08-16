# Core Concepts

## Provider 共通タスク

```text
用途 / workflow 選択
  → SubmissionQueue（未送信）
  → POST /api/generate { provider, operation, model, input }
  → サーバーが HistoryItem を SQLite へ upsert（CLI / UI / エージェント共通）
  → GET /api/task?provider=&operation=&taskId= でポーリング（終端は履歴へ mirror）
  → success / partial なら media/ へローカルアーカイブ
  → generating / partial / success / fail / expired を反映
```

`MarketAdapter` / `SunoAdapter` / `VeoAdapter` / `RunwayAdapter` は、作成・状態・エラー・メディアを `NormalizedTask` へ揃える。Market は provider / operation 省略時の既定。

## 主要型

- `ModelCategory`: `image | video | audio`
- `Provider`: `market | suno | veo | runway`
- `TaskState`: waiting / queuing / generating / partial / success / fail / expired / unknown
- `MediaAsset`: URL、stream、preview、duration、waveform、alignedWords、expiresAt、providerAssetId、**localPath**
- `HistoryItem`: provider、operation、parentTaskId、media、rawParam、rawResult
- `SubmissionQueueItem`: 未送信、再試行回数、送信可能時刻

## AUDIO workflow

- 楽曲: Suno 生成、延長、アップロード延長、カバー、歌詞、区間置換
- ナレーション: 空行ごとに分割し `previous_text` / `next_text` を自動接続
- 会話: 話者行の追加・並べ替え・ブラウザ試聴
- 音声処理: Market の isolation / TTS
- 同期歌詞は初回表示時に取得して履歴へキャッシュ。再生位置へ追従しクリックでシーク
- Persona と外部音源メタデータは素材棚として SQLite に保存

## History / media

履歴は `data/studio.db`（デスクトップは `STUDIO_DB_PATH`）。旧 `resultUrls` は additive migration で `media[]` へ変換する。親子関係は Suno 編集と Aleph Before/After に使う。

リモート URL は kie.ai 側で期限切れする（Gallery に残日数を出す）。終端後は `server/media/archiver.ts` が一時 download URL から `media/{taskId}/` へ保存し、`MediaAsset.localPath` を履歴へ merge する。UI は `localPath` があれば `GET /media/...` を使う。ZIP エクスポートは一時 URL からストリーミングする。

ポーリング失敗も `POLL_ERROR` と元エラーを `rawResult` に残し、詳細画面からコピーできる。

## See Also

- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
