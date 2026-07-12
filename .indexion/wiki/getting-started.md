# Getting Started

## セットアップ

```bash
cp .env.example .env
# .env に https://kie.ai/api-key で取得したキーを設定
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://127.0.0.1:8787（Vite が `/api` をプロキシ）

プロンプト最適化を使う場合は [Grok CLI](https://docs.x.ai/build/overview) を入れ、`grok login` するか `.env` に `XAI_API_KEY` を設定する。

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | 必須。kie.ai API キー |
| `PORT` | API ポート（既定 `8787`） |
| `XAI_API_KEY` | 任意。Grok CLI 未ログイン時の認証 |
| `SYNC_MODELS_ON_START` | `0` で起動時同期オフ |
| `SYNC_MODELS_FORCE` | `1` で起動時に強制フル同期 |
| `SYNC_CONCURRENCY` | モデルページ取得の並列数（既定 `12`、最大 32） |

## よく使うコマンド

```bash
npm run dev              # server + web
npm run lint
npm run build
npm run sync:models      # カタログ同期
npm run sync:models -- --force
```

## カタログ同期の挙動

`npm run dev` 起動時、カタログが古い場合（目安: 12 時間以上）だけ docs から自動同期する。

- 新鮮ならスキップ（`tsx watch` の再起動でも無駄なフル同期は走らない）
- 強制更新: `SYNC_MODELS_FORCE=1 npm run dev` または `npm run sync:models -- --force`
- 起動時同期オフ: `SYNC_MODELS_ON_START=0`

## See Also

- [Overview](wiki://overview)
- [Architecture](wiki://architecture)
- [Catalog Sync](wiki://catalog-sync)
- [Prompt Optimize](wiki://prompt-optimize)
