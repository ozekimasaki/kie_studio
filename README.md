# KIE STUDIO

kie.ai の Market API で **IMAGE / VIDEO** モデルを試すローカル Studio。

- Vite + React 19 + Tailwind CSS v4
- Hono API（API キーはサーバー側のみ）
- モデルカタログは docs の OpenAPI から同期可能
- Reference アップロード / 数値 / チェックボックスの動的フォーム

## セットアップ

```bash
cp .env.example .env
# .env に https://kie.ai/api-key で取得したキーを設定
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787（Vite が `/api` をプロキシ）

## モデルカタログの同期

`npm run dev` 起動時に、カタログが古い場合（既定: 12時間以上）は docs から自動同期します。

- 新鮮ならスキップ（`tsx watch` の再起動でも毎回フル同期しない）
- 強制更新: `SYNC_MODELS_FORCE=1 npm run dev` または `npm run sync:models -- --force`
- 起動時同期オフ: `SYNC_MODELS_ON_START=0`

手動同期:

```bash
npm run sync:models
npm run sync:models -- --force
```

[llms.txt](https://docs.kie.ai/llms.txt) と各モデルページの OpenAPI から `src/data/catalog.json` を再生成します。

## 主な API（ローカル）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/models?category=image\|video` | カタログ |
| POST | `/api/upload` | File Upload API へ転送 |
| POST | `/api/generate` | Market `createTask` |
| GET | `/api/task?taskId=` | `recordInfo` |
| GET | `/api/credits` | 残クレジット |
| POST | `/api/download-url` | 一時 DL URL（20分） |

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | 必須。kie.ai API キー |
| `PORT` | API ポート（既定 `8787`） |
| `SYNC_MODELS_ON_START` | `0` で起動時同期オフ（既定オン） |
| `SYNC_MODELS_FORCE` | `1` で起動時に強制フル同期 |
| `SYNC_CONCURRENCY` | モデルページ取得の並列数（既定 `12`、最大 32） |

## 注意

- アップロードファイルは一時保管（docs 上は短期間で削除）
- 生成メディアも kie.ai 側で期限あり。必要なら早めにダウンロード
- Music / Suno / 専用 API（Veo, Runway 等）は対象外
