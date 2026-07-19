# Client Lib

フロント共有ロジック（`src/lib/`）。

| ファイル | 役割 |
|------|------|
| `api.ts` | provider 対応 generate/task、Suno、Persona、素材棚、archive クライアント |
| `submissionQueue.ts` / `useSubmissionQueue.ts` | 20件/10秒、429再送、未送信キャンセル、課金エラー分類 |
| `workflowValidation.ts` | Suno区間、Runway組合せ、TTS分割、lip-sync pairing |
| `taskRelations.ts` | 編集・Aleph の parent task 決定 |
| `history.ts` / `useHistoryPersistence.ts` | 履歴 cap、正規化、SQLite PUT の直列化 |
| `form.ts` | default、dirty、schema 制約検証、先頭 error focus |
| `models/types.ts` | Provider / Operation / MediaAsset / HistoryItem 等の共有型 |
| `models/from-openapi.ts` | OpenAPI と説明文から field / 制約を抽出 |
| `media.ts` / `mediaExpiry.ts` | media 種別と期限表示 |

## 規約

- API は相対 `/api`。失敗は status / code を持つ `ApiClientError`
- フィールド switch は `default` で `never` を検査
- `reference + scalar` は UI の配列から API の単一 URL へ変換
- 未知の履歴 input key は復元時に破棄する
- exact `expiresAt` がなければ推測日時を出さず、早めの保存だけ促す

## See Also

- [Frontend](wiki://frontend)
- [Core Concepts](wiki://core-concepts)
- [Catalog Sync](wiki://catalog-sync)
