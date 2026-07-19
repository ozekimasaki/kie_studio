# Catalog Sync

docs.kie.ai の Market IMAGE / VIDEO / AUDIO OpenAPI を `src/data/catalog.json` へ同期する。Suno / Veo / Runway の専用 workflow は `server/catalog/dedicated.ts` で追加する。

## 入口

| 入口 | 説明 |
|------|------|
| `server/catalog/sync.ts` | llms.txt、page fetch、catalog write、mtime cache |
| `scripts/sync-models.ts` | `npm run sync:models` |
| `src/lib/models/from-openapi.ts` | OpenAPI / 説明文 → `FieldSchema` |
| `server/catalog/dedicated.ts` | provider 専用 workflow fallback |
| `server/routes/models.ts` | catalog と workflow を hydrate / dedupe |

## 抽出

- category は image / video / audio
- URL 型は image / video / audio の reference と scalar/array を識別
- required、enum、min/max、文字数、参照数、容量、duration を抽出
- OpenAPI に制約がなくても `Required field`、`Max length`、`4-15 seconds` のような説明文を補助的に読む
- trailing-space key は trim して API key の表記揺れを抑える

Market の専用 UI model（ElevenLabs / lip-sync）は、同期 catalog の schema を正として id、title、useCase 等の UI metadata だけ上書きする。

## 同期ポリシー

起動時は古い場合だけ同期する。`SYNC_MODELS_ON_START=0` で無効、`SYNC_MODELS_FORCE=1` または `npm run sync:models -- --force` で強制。失敗時は既存 catalog を使う。

## See Also

- [Getting Started](wiki://getting-started)
- [Core Concepts](wiki://core-concepts)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
