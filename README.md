# KIE STUDIO

kie.ai の Market API と専用 workflow で **IMAGE / VIDEO / AUDIO** を扱うローカル Studio。

- Vite + React 19 + Tailwind CSS v4
- Hono API（API キーはサーバー側のみ）
- docs OpenAPI と専用 workflow を統合したモデルカタログ
- Reference アップロード / 数値 / チェックボックスの動的フォーム
- Market / Suno / Veo / Runway の生成・状態を共通形式で管理
- 履歴ギャラリー（複数メディア・同期歌詞・ピン・再利用・リトライ・JSON 入出力）
- 会話・ナレーション編集と画面をまたいで再生できる音声プレイヤー
- プロンプト最適化（Grok CLI）とスニペット
- `@参照` 挿入・Kling Elements 対応

> エージェント向けの作業ガイドは [AGENTS.md](./AGENTS.md)、UI/デザイン方針は [DESIGN.md](./DESIGN.md) を参照。

## 要件

- Node.js（Vite 8 / React 19 が動作する最近の LTS。目安: 20.19+ または 22.12+）と npm
- kie.ai の API キー（<https://kie.ai/api-key>）
- 任意: プロンプト最適化を使う場合は [Grok CLI](https://docs.x.ai/build/overview)（認証は `grok login` または `XAI_API_KEY`）

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
| Provider 共通タスク | Market / Suno / Veo / Runway の生成・ポーリング・エラーを正規化 |
| AUDIO workflow | Suno 楽曲・延長・カバー・歌詞、ナレーション、会話、音声処理 |
| 音声再生 | 常駐ミニプレイヤー、波形、同期歌詞、Persona・外部音源素材棚 |
| 履歴 | SQLite 保存。複数メディア、親子関係、ピン、入力復元、リトライ、ZIP/JSON 出力 |
| プロンプト最適化 | Grok CLI で optimize / generate。モデル別プロファイルあり |
| スニペット | よく使うフレーズをワンクリック挿入 |
| バッチ生成 | 同じ入力で複数タスクをまとめて投入 |

## 主な API（ローカル）

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/health` | ヘルスチェック・API キー有無 |
| GET | `/api/models?category=image\|video\|audio` | Market catalog と専用 workflow を統合 |
| POST | `/api/upload` | File Upload API へ転送。音源は素材棚へ登録 |
| GET | `/api/audio-assets` | 外部音源素材棚の一覧 |
| DELETE | `/api/audio-assets/:id` | 外部音源素材を削除 |
| POST | `/api/generate` | provider / operation adapter でタスク作成 |
| GET | `/api/task?provider=&operation=&taskId=` | provider ごとの状態を共通形式へ正規化 |
| GET | `/api/credits` | 残クレジット |
| POST | `/api/download-url` | 一時 DL URL（20分） |
| POST | `/api/archive` | 複数メディアと歌詞を ZIP 出力 |
| POST | `/api/suno/timestamped-lyrics` | 同期歌詞・波形データを取得 |
| POST | `/api/suno/style` | Suno の music style を補助 |
| POST | `/api/suno/persona` | Persona を作成・保存 |
| GET | `/api/personas` | Persona 素材棚の一覧 |
| DELETE | `/api/personas/:id` | Persona を削除 |
| GET | `/api/grok/status` | Grok CLI 利用可否 |
| GET | `/api/optimize-profile?modelId=` | モデル別最適化プロファイル |
| POST | `/api/optimize-prompt` | プロンプト最適化 / 生成 |
| GET | `/api/history` | 履歴一覧（SQLite） |
| PUT | `/api/history` | 履歴を一括置換 |
| POST | `/api/history/import` | JSON から履歴をインポート |
| POST | `/api/history/migrate` | 旧 localStorage 履歴を移行 |

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
| `npm run dev` | API + Web を同時起動（`dev:server` + `dev:web`） |
| `npm run dev:server` | Hono API のみ（`tsx watch server/index.ts`） |
| `npm run dev:web` | Vite 開発サーバーのみ |
| `npm run build` | 型チェック（`tsc -b`）+ 本番ビルド |
| `npm run preview` | ビルド成果物をプレビュー |
| `npm run lint` | oxlint |
| `npm test` | Vitest を1回実行 |
| `npm run test:watch` | Vitest を watch モードで実行 |
| `npm run sync:models` | カタログ手動同期 |

型チェックのみ実行したい場合は `npx tsc -b`（`npm run build` に含まれる）。

## 構成

```text
src/            # フロント（Vite + React 19 + Tailwind v4）
  App.tsx       # フォーム・キュー・履歴・ポーリング・Quick Action の調停
  components/   # 画面 UI（audio/ ・ shell/ ・ motion/ を含む）
  lib/          # API・履歴・キュー・検証・メディア・models
  data/catalog.json  # 同期で再生成されるモデルカタログ
server/         # Hono API（127.0.0.1:8787）
  index.ts      # エントリ・CORS・onError・起動時カタログ同期
  routes/       # HTTP 境界（generate / task / Suno / archive / history 等）
  kie/adapters/ # Market / Suno / Veo / Runway の共通化
  db/           # SQLite（履歴・Persona・音源素材、既定 data/studio.db）
  grok/         # Grok CLI 連携（プロンプト最適化）
  catalog/      # docs OpenAPI と専用 workflow の統合
scripts/sync-models.ts  # カタログ同期 CLI
.indexion/wiki/         # プロジェクト知識ベース（indexion wiki）
```

## 注意

- アップロードファイルは一時保管（docs 上は短期間で削除）
- 生成メディアは約14日で削除（ギャラリーに残日数表示）。必要なら早めにダウンロード
- 対応 provider / operation はカタログに定義された workflow に限る
- エージェント向けの作業メモは [AGENTS.md](./AGENTS.md) を参照

## ライセンス

ライセンスは未指定です。`package.json` は `private: true` で、npm publish は無効化されています。
