# Core Concepts

## Provider 共通タスク

```text
用途 / workflow 選択
  → SubmissionQueue（未送信）
  → POST /api/generate { provider, operation, model, input }
  → API受付済みの HistoryItem を SQLite へ保存
  → GET /api/task?provider=&operation=&taskId= でポーリング
  → generating / partial / success / fail / expired を反映
```

`MarketAdapter` / `SunoAdapter` / `VeoAdapter` / `RunwayAdapter` は、作成・状態・エラー・メディアを `NormalizedTask` へ揃える。Market は provider / operation 省略時の既定。

## 主要型

- `ModelCategory`: `image | video | audio`
- `Provider`: `market | suno | veo | runway`
- `TaskState`: waiting / queuing / generating / partial / success / fail / expired / unknown
- `MediaAsset`: URL、stream、preview、duration、waveform、alignedWords、expiresAt、providerAssetId
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

履歴は `data/studio.db`。旧 `resultUrls` は additive migration で `media[]` へ変換する。メディア本体は永続保存せず、ZIP も一時 download URL からストリーミングする。親子関係は Suno 編集と Aleph Before/After に使う。

ポーリング失敗も `POLL_ERROR` と元エラーを `rawResult` に残し、詳細画面からコピーできる。

## See Also

- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
