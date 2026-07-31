# Architecture

## レイヤ構成

```text
Browser (Vite :5173)
  App / components / lib
    ├─ SubmissionQueue (20 requests / 10 seconds)
    ├─ AudioPlayerProvider (single persistent player)
    └─ fetch('/api/...')
             │
             ▼
Hono (:8787)
  ├─ routes/*          HTTP boundary
  ├─ kie/adapters/*    Market / Suno / Veo / Runway normalization
  ├─ db/*              history / personas / audio assets
  ├─ catalog/*         docs + dedicated workflows
  └─ grok/*            prompt optimization
```

`KIE_API_KEY` は Hono 側のみ。フロントは相対 `/api` だけを呼ぶ。

## Desktop 層（Electrobun）

デスクトップ版は Electrobun（Bun メインプロセス `src/bun/index.ts` + ネイティブ webview）。`Bun.serve` で Hono を起動し、ビルド済み UI を `views://mainview/` でロードする。設定は `electrobun.config.ts`。

- DB（`studio.db`）は `STUDIO_DB_PATH` で userData 配下（`Utils.paths.userData`）に配置。dev は `data/studio.db`。
- 自動アップデート: `RELEASE_BASE_URL` 設定時に bsdiff + zstd の差分更新。未設定時はスキップ。

## パッケージ責務

| パス | 役割 |
|------|------|
| `src/App.tsx` | フォーム、キュー、履歴、ポーリング、Quick Action の調停 |
| `src/components/audio/` | 会話・ナレーション編集と常駐プレイヤー |
| `src/components/History*` | 複数メディア、同期歌詞、Before/After、API 詳細 |
| `src/lib/` | API、型、履歴、キュー、検証、親子関係 |
| `src/bun/index.ts` | Electrobun メインプロセス（Bun.serve + BrowserWindow + updater） |
| `server/kie/adapters/` | provider 差分の正規化 |
| `server/db/` | 加算マイグレーションを行う SQLite |
| `server/catalog/` | Market カタログと専用 workflow の統合 |
| `server/routes/archive.ts` | 一時 URL から ZIP をストリーミング |

## デスクトップ配布

| プラットフォーム | 成果物 | 備考 |
|------|------|------|
| Windows x64 | `canary-win-x64-KIESTUDIO-Setup.exe`（Inno Setup） | 第一導線。ARP 登録・アンインストーラー・ショートカット・アイコン。per-user（`%LocalAppData%\ai.kie.studio\<ch>\app`、管理者権限不要） |
| Linux x64 | `canary-linux-x64-KIESTUDIO-canary-Setup.tar.gz` | tar.gz 自己展開のみ（`.deb` は Electrobun 非対応） |
| 自動アップデート | `*.tar.zst` + `update.json` + patch | `RELEASE_BASE_URL` 配下へ配信（Inno Setup 非依存） |

- Windows インストーラーは `installer/win/kie-studio.iss` + `scripts/build-win-installer.mjs`（tar.zst 展開 → launcher.exe へ rcedit アイコン埋め込み → ISCC コンパイル）。`npm run desktop:installer:win`。
- アイコン: `assets/icon-master.svg` → `npm run icons`（sharp + png-to-ico）→ `icon.ico`（Win）/ `icon.png`（Linux）。Electrobun 本体の rcedit パス解決バグを避け launcher.exe へ自前埋め込み。
- arm64: win-arm64 は x64 版が OS エミュレーションで動作（個別ビルド不要）。linux-arm64 はクロスビルド不可のため一旦見送り。
- アンインストールは `app\` のみ削除し、親ディレクトリの `studio.db`（ユーザー DB）は保持する（親削除は DB 破壊のため禁止）。
- `release/` 集積: Electrobun はビルドごとに `artifacts/` を削除・再生成するため、`scripts/collect-release.mjs` が永続的な `release/` へコピーする。

## 拡張ポイント

- provider 追加: `ProviderAdapter` を実装し adapter registry へ登録
- workflow 追加: `server/catalog/dedicated.ts`。Market schema は同期カタログを優先して UI メタデータだけ上書き
- 特殊 UI: `FieldType` / `DynamicForm` / workflow validation を一連で更新
- DB 変更: `server/db/open.ts` の加算マイグレーションを使う

## See Also

- [Core Concepts](wiki://core-concepts)
- [Server API](wiki://server-api)
- [Kie Integration](wiki://kie-integration)
- [Frontend](wiki://frontend)
