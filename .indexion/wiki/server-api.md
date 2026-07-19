# Server API

Hono エントリは `server/index.ts`。`127.0.0.1:8787` で待受し、API key はサーバーだけが保持する。

## 主要ルート

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/models?category=` | Market catalog と専用 workflow を統合 |
| POST | `/api/upload` | 一意名で Upload API へ転送。音源は素材棚へ登録 |
| GET/DELETE | `/api/audio-assets[/:id]` | 外部音源素材棚 |
| POST | `/api/generate` | provider / operation adapter で作成。Market は既定 |
| GET | `/api/task` | provider / operation ごとの状態を正規化 |
| POST | `/api/suno/timestamped-lyrics` | alignedWords / waveformData |
| POST | `/api/suno/style` | music style 補助 |
| POST | `/api/suno/persona` | Persona 作成と保存 |
| GET/DELETE | `/api/personas[/:id]` | Persona 素材棚 |
| POST | `/api/archive` | 複数 media と lyrics を ZIP streaming |
| GET/PUT | `/api/history` | SQLite 履歴一覧 / 全置換 |
| POST | `/api/history/import` | JSON merge |
| POST | `/api/history/migrate` | 旧 localStorage 移行 |
| GET | `/api/credits` | 残高 |
| POST | `/api/download-url` | 一時 download URL |

## DB

`data/studio.db` に `history_items`、`saved_personas`、`saved_audio_assets` を持つ。履歴スキーマは provider、operation、parent、media、raw param/result を additive migration で追加する。メディア本体は保存しない。

## エラー

`KieApiError` は `{ error, code }` と適切な status に変換する。Malformed JSON は 400。polling 側の upstream error はフロント履歴にも診断として残す。

## See Also

- [Architecture](wiki://architecture)
- [Kie Integration](wiki://kie-integration)
- [Catalog Sync](wiki://catalog-sync)
