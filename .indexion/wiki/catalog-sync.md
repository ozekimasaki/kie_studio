# Catalog Sync

docs.kie.ai の Market IMAGE / VIDEO / AUDIO OpenAPI を `src/data/catalog.json` へ同期する。Suno / Veo / Runway の専用 workflow は `server/catalog/dedicated.ts` で追加する。

## 入口

| 入口 | 説明 |
|------|------|
| `server/catalog/sync.ts` | llms.txt、page fetch、catalog write、mtime cache、desktop 再 seed 判定 |
| `scripts/sync-models.ts` | `npm run sync:models`（`--ignore-age` / `--force`） |
| `src/lib/models/from-openapi.ts` | OpenAPI / 説明文 → `FieldSchema` |
| `server/catalog/dedicated.ts` | provider 専用 workflow fallback |
| `server/routes/models.ts` | catalog と workflow を hydrate / dedupe |
| `src/bun/index.ts` | デスクトップ userData へバンドル catalog を seed / 再 seed。起動時 ignore-age 同期 |
| `server/catalog/runtime-sync.ts` | dev / desktop の起動同期と desktop の 6h 再確認 |
| `.github/workflows/catalog-sync.yml` | 毎日同梱 catalog を同期して PR |
| `.github/workflows/release.yml` | タグビルド前に catalog を1回同期して各 OS へ配る |

## 抽出

- category は image / video / audio
- model slug は request example の `model`、説明文の `Must be X`、enum、default の順で採用し、docs の schema 誤記に耐える
- URL 型は image / video / audio の reference と scalar/array を識別
- required、enum、min/max、文字数、参照数、容量、duration を抽出
- OpenAPI に制約がなくても `Required field`、`Max length`、`4-15 seconds` のような説明文を補助的に読む
- trailing-space key は trim して API key の表記揺れを抑える

Market の専用 UI model（ElevenLabs / lip-sync）は、同期 catalog の schema を正として id、title、useCase 等の UI metadata だけ上書きする。同一 model ID が複数ページから抽出された場合は field 数が多い定義を採用し、衝突を警告する。

## 同期ポリシー

dev 起動時は古い場合だけ同期する。パッケージ済みデスクトップは起動のたびに llms.txt を確認する（`--ignore-age` 相当）。`SYNC_MODELS_ON_START=0` で無効、`SYNC_MODELS_FORCE=1` または `npm run sync:models -- --force` で強制。`--ignore-age` は 12h 新鮮さ判定だけをスキップし、llms.txt hash と 70% 縮小保護は残す。モデルの `.md` 取得は最大3回リトライしてから通常ページへフォールバックする。

通常同期の抽出結果が既存 catalog の70%未満なら、部分的な取得失敗とみなして既存 catalog を維持する。明示的な force sync はこの保護を迂回して再生成する。失敗時は既存 catalog を使う。

起動同期は非ブロッキング。`GET /api/health` の `catalogSyncedAt` が変わるとフロントが models クエリを invalidate する。マウント後約90秒の再取得は保険。Settings の「モデルを更新」は force sync のあと `['models']` を invalidate する。

## 同梱 catalog の自動更新

`src/data/catalog.json` はリポジトリにコミットするデスクトップの seed である。

- 毎日 00:00 JST に `catalog-sync.yml` が `--ignore-age` で同期し、差分があれば `chore/catalog-sync` ブランチへ force-push して PR を開く / 更新する。workflow_dispatch で `--force` も選べる。PR の CI を動かしたい場合は repo secret `CATALOG_SYNC_TOKEN`（workflow 起動可能な PAT）を置く
- `v*` タグの `release.yml` は mac/win/linux の前に1ジョブで同期し、同じ `catalog.json` を artifact として各ビルドへ渡す。docs 障害時は committed snapshot のまま続行する
- インストール済みアプリは userData の `catalog.json` を起動時に docs.kie.ai と突き合わせ、起動中は 6 時間おきに再確認する。バンドル seed より新しいネットワーク結果は残す

## Desktop seed

パッケージ済みアプリは `STUDIO_CATALOG_PATH`（userData の `catalog.json`）を使う。バンドルの `src/data/catalog.json` を次のとき書き出す。

- userData にファイルが無い、または JSON が壊れている
- バンドルの `syncedAt` が userData より新しい（アプリ更新で同梱 catalog が進んだとき）

userData 側がネットワーク同期などで新しい場合は上書きしない。

## See Also

- [Getting Started](wiki://getting-started)
- [Core Concepts](wiki://core-concepts)
- [Architecture](wiki://architecture)
- [Frontend](wiki://frontend)
- [Client Lib](wiki://client-lib)
- [Server API](wiki://server-api)
- [Agent Mode](wiki://agent-mode)
