# KIE STUDIO

kie.ai の Market API で **IMAGE / VIDEO** モデルを試すローカル Studio。

- Vite + React 19 + Tailwind CSS v4
- Hono API（API キーはサーバー側のみ）
- モデルカタログは docs の OpenAPI から同期可能
- Reference アップロード / 数値 / チェックボックスの動的フォーム
- 履歴ギャラリー（ピン留め・再利用・リトライ・JSON 入出力）
- プロンプト最適化（Grok CLI）とスニペット
- `@参照` 挿入・Kling Elements 対応

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

## 主な機能

| 機能 | 説明 |
|------|------|
| 動的フォーム | カタログの OpenAPI スキーマからフィールドを生成 |
| Reference | 画像/動画/音声のアップロード。単数 `image_url` もファイル添付 UI |
| `@参照` | プロンプトへリファレンスメンションを挿入（Seedance / Kling 等） |
| 履歴 | ローカル保存。ピン・ギャラリー・入力復元・リトライ・エクスポート |
| プロンプト最適化 | Grok CLI で optimize / generate。モデル別プロファイルあり |
| スニペット | よく使うフレーズをワンクリック挿入 |
| バッチ生成 | 同じ入力で複数タスクをまとめて投入 |

## 主な API（ローカル）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/health` | ヘルスチェック・API キー有無 |
| GET | `/api/models?category=image\|video` | カタログ |
| POST | `/api/upload` | File Upload API へ転送 |
| POST | `/api/generate` | Market `createTask` |
| GET | `/api/task?taskId=` | `recordInfo` |
| GET | `/api/credits` | 残クレジット |
| POST | `/api/download-url` | 一時 DL URL（20分） |
| GET | `/api/grok/status` | Grok CLI 利用可否 |
| GET | `/api/optimize-profile?modelId=` | モデル別最適化プロファイル |
| POST | `/api/optimize-prompt` | プロンプト最適化 / 生成 |

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | 必須。kie.ai API キー |
| `PORT` | API ポート（既定 `8787`） |
| `XAI_API_KEY` | 任意。Grok CLI 未ログイン時の認証 |
| `SYNC_MODELS_ON_START` | `0` で起動時同期オフ（既定オン） |
| `SYNC_MODELS_FORCE` | `1` で起動時に強制フル同期 |
| `SYNC_CONCURRENCY` | モデルページ取得の並列数（既定 `12`、最大 32） |

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | API + Web を同時起動 |
| `npm run build` | 型チェック + 本番ビルド |
| `npm run lint` | oxlint |
| `npm run sync:models` | カタログ手動同期 |

## 注意

- アップロードファイルは一時保管（docs 上は短期間で削除）
- 生成メディアも kie.ai 側で期限あり。必要なら早めにダウンロード
- Music / Suno / 専用 API（Veo, Runway 等）は対象外
- エージェント向けの作業メモは [AGENTS.md](./AGENTS.md) を参照
