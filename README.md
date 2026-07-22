# KIE STUDIO

kie.ai の Market API と専用 workflow で **IMAGE / VIDEO / AUDIO** を扱う Studio。ブラウザ（Vite + React）でも、**Electrobun でパッケージした単一デスクトップアプリ**（Win/mac/Linux）でも動作する。

- Vite + React 19 + Tailwind CSS v4
- Hono API（Bun ランタイムで起動。API キーはサーバー側のみ）
- Electrobun デスクトップ版（ネイティブ webview + Bun メインプロセス、差分自動アップデート）
- docs OpenAPI と専用 workflow を統合したモデルカタログ
- Reference アップロード / 数値 / チェックボックスの動的フォーム
- Market / Suno / Veo / Runway の生成・状態を共通形式で管理
- 履歴ギャラリー（複数メディア・同期歌詞・ピン・再利用・リトライ・JSON 入出力）
- 会話・ナレーション編集と画面をまたいで再生できる音声プレイヤー
- プロンプト最適化（Grok CLI）とスニペット
- `@参照` 挿入・Kling Elements 対応

> エージェント向けの作業ガイドは [AGENTS.md](./AGENTS.md)、UI/デザイン方針は [DESIGN.md](./DESIGN.md) を参照。

## 要件

- [Bun](https://bun.sh)（サーバー起動 `dev:server` と Electrobun ビルドに必須）
- Node.js（Vite 8 / React 19 が動作する最近の LTS。目安: 20.19+ または 22.12+）と npm
- kie.ai の API キー（<https://kie.ai/api-key>）。デスクトップ版はアプリ内の設定画面からも保存可能
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

## デスクトップ版（Electrobun）

Bun が必要です。ネイティブ webview 上でビルド済み UI をロードし、Hono API を Bun メインプロセス内で起動します。

```bash
npm run desktop:dev            # 開発（electrobun run --env=dev）
npm run desktop:build:canary   # canary ビルド（vite build + electrobun build）
npm run desktop:build:stable   # stable ビルド
```

- **API キー**: 初回は `.env` 不要。アプリ右上の設定アイコンから保存でき、SQLite に永続化されます（保存キーが環境変数より優先）。
- **データ保存先**: DB はアプリのユーザーデータ領域（`Utils.paths.userData` 配下の `studio.db`）に作成されます。dev は `data/studio.db`。
- **配布形態**:
  - **Windows**: Inno Setup 製の `canary-win-x64-KIESTUDIO-Setup.exe`（第一導線）。`npm run desktop:installer:win` で生成します。プログラム追加/削除（ARP）にアイコン・バージョン・発行者付きで登録され、アンインストーラーとスタートメニュー/デスクトップショートカットが付きます。per-user インストール（`%LocalAppData%\ai.kie.studio\<channel>\app`）で管理者権限不要。アンインストールでもユーザー DB（`studio.db`）は削除されません。
  - **Linux**: tar.gz 自己展開アーカイブ（`canary-linux-x64-KIESTUDIO-canary-Setup.tar.gz`）のみ。Electrobun は `.deb` 非対応のため採用していません。
  - 自動アップデート用（`tar.zst` + `update.json` + patch）は `RELEASE_BASE_URL` 配下へ従来通り配信します（Inno Setup に依存しません）。
- **アプリアイコン**: `assets/icon-master.svg`（プリズムモチーフ）を `npm run icons` で `icon.ico`（Windows・マルチサイズ）/ `icon.png`（Linux・512px）へ変換し `electrobun.config.ts` で指定します。Windows は Electrobun 本体の rcedit パス解決バグを避け、インストーラービルド時に launcher.exe へ自前でアイコンを埋め込みます。
- **サポートアーキテクチャ**:
  - Windows: x64 のみ。ARM Windows は x64 版が OS の自動エミュレーションで動作するため個別ビルドは不要です。
  - Linux: x64 のみ配布。arm64 は Electrobun 対応ですがクロスビルド不可のため一旦見送り（arm64 ビルド環境/CI 確保後に別対応）。
- **未署名配布の OS 警告**: コード署名・公証は行っていないため OS 警告が出ます。
  - macOS: 初回は右クリック→「開く」、または「システム設定 > プライバシーとセキュリティ」で許可。
  - Windows: SmartScreen で「詳細情報」→「実行」。
  - Linux: 実行権限を付与。
- **自動アップデート**: `RELEASE_BASE_URL` に静的ホストを設定すると、起動時に差分（bsdiff + zstd）で自動更新します。未設定時はサイレントにスキップ。日常検証は `canary`、正式配布は `stable` チャネル。
- 各 OS のビルドはその OS 上で実行します（クロスビルド不可）。CI 例は `.github/workflows/release.yml`（タグ push で 3 OS をマトリクスビルドし GitHub Releases へ公開）。

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
| GET | `/api/settings` | API キーの保存有無とマスク表示 |
| PUT | `/api/settings/api-key` | API キーを保存（SQLite に永続化） |
| DELETE | `/api/settings/api-key` | 保存した API キーを削除 |

## 環境変数

| 変数 | 説明 |
|------|------|
| `KIE_API_KEY` | 任意。kie.ai API キー（デスクトップ版は設定画面からも保存可。保存キーが優先） |
| `PORT` | API ポート（既定 `8787`） |
| `STUDIO_DB_PATH` | 任意。SQLite の保存先を上書き（デスクトップ版は自動設定、dev は `data/studio.db`） |
| `RELEASE_BASE_URL` | 任意。Electrobun 自動アップデートの静的ホスト URL（空で無効） |
| `XAI_API_KEY` | 任意。Grok CLI 未ログイン時の認証 |
| `SYNC_MODELS_ON_START` | `0` で起動時同期オフ（既定オン） |
| `SYNC_MODELS_FORCE` | `1` で起動時に強制フル同期 |
| `SYNC_CONCURRENCY` | モデルページ取得の並列数（既定 `12`、最大 32） |

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | API + Web を同時起動（`dev:server` + `dev:web`） |
| `npm run dev:server` | Hono API のみ（`bun --watch server/index.ts`） |
| `npm run dev:web` | Vite 開発サーバーのみ |
| `npm run desktop:dev` | Electrobun デスクトップを開発起動（`electrobun run --env=dev`） |
| `npm run desktop:build:canary` | canary デスクトップビルド（`vite build` + `electrobun build`） |
| `npm run desktop:build:stable` | stable デスクトップビルド |
| `npm run desktop:package:canary` | canary を再パッケージ（`vite build` スキップ。アイコン生成 + `electrobun build` + `release/` 集積） |
| `npm run desktop:package:stable` | stable を再パッケージ |
| `npm run desktop:installer:win` | Windows 用 Inno Setup インストーラーを生成（要 Inno Setup 6、`release/` へ出力） |
| `npm run icons` | `assets/icon-master.svg` から `icon.ico` / `icon.png` を生成 |
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
  components/   # 画面 UI（audio/ ・ shell/ ・ motion/ を含む、SettingsSheet など）
  lib/          # API・履歴・キュー・検証・メディア・models
  bun/          # Electrobun メインプロセス（index.ts: Bun.serve + BrowserWindow）
  data/catalog.json  # 同期で再生成されるモデルカタログ
server/         # Hono API（Bun ランタイム、127.0.0.1:8787）
  app.ts        # createApp（CORS・onError・全ルート登録を共通化）
  index.ts      # dev エントリ（Bun.serve 起動・起動時カタログ同期）
  routes/       # HTTP 境界（generate / task / Suno / archive / history / settings 等）
  kie/adapters/ # Market / Suno / Veo / Runway の共通化
  settings/     # API キー取得（永続ストア→環境変数）
  db/           # bun:sqlite（履歴・Persona・音源素材・app_settings）
  grok/         # Grok CLI 連携（プロンプト最適化）
  catalog/      # docs OpenAPI と専用 workflow の統合
electrobun.config.ts    # Electrobun ビルド・配布設定（win/linux のアイコン指定を含む）
assets/icon-master.svg  # アプリアイコンのベクターマスター（→ icon.ico / icon.png）
installer/win/kie-studio.iss   # Inno Setup インストーラー定義（ARP・アンインストーラー・ショートカット）
scripts/build-icons.mjs        # icon-master.svg → icon.ico / icon.png（sharp + png-to-ico）
scripts/build-win-installer.mjs # tar.zst 展開 → launcher.exe へアイコン埋め込み → Inno Setup コンパイル
scripts/collect-release.mjs    # ビルド成果物を永続的な release/ へ集積
scripts/sync-models.ts  # カタログ同期 CLI
.github/workflows/release.yml  # 3 OS マトリクスビルド + Releases 公開
.indexion/wiki/         # プロジェクト知識ベース（indexion wiki）
```

## 注意

- アップロードファイルは一時保管（docs 上は短期間で削除）
- 生成メディアは約14日で削除（ギャラリーに残日数表示）。必要なら早めにダウンロード
- 対応 provider / operation はカタログに定義された workflow に限る
- エージェント向けの作業メモは [AGENTS.md](./AGENTS.md) を参照

## ライセンス

ライセンスは未指定です。`package.json` は `private: true` で、npm publish は無効化されています。
