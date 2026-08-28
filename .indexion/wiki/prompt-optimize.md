# Prompt Optimize

Grok CLI を使ったプロンプト最適化（`server/grok/` + UI `PromptOptimizePanel`）。

## モジュール

| ファイル | 役割 |
|----------|------|
| `server/grok/cli.ts` | Grok CLI 起動・タイムアウト・出力パース |
| `server/grok/optimize-model.ts` | `grok models` 出力のパースと最適化用モデル選択 |
| `server/grok/optimize-profiles.ts` | モデル別最適化ルール / 埋め込みガイド選択 |
| `server/grok/guides/seedance.ts` | Seedance 2.0 系の埋め込みガイド |
| `server/grok/guides/seedance-2-5.ts` | BytePlus / Dreamina 公式ガイドと `sd25-pe` skill に基づく Seedance 2.5 専用ガイド |
| `server/grok/guides/minimax-h3.ts` | MiniMax H3 公式 base/ref ガイドとコミュニティ知見の埋め込みガイド |
| `server/grok/guides/kling.ts` | Kling 2.x 単ショット / 3.0 マルチショット |
| `server/grok/guides/wan.ts` | 阿里雲 Wan 動画（Entity+Scene+Motion、`Image n`） |
| `server/grok/guides/wan-image.ts` | Wan 2.7 静止画（動画 Wan と分離） |
| `server/grok/guides/hailuo.ts` | Hailuo 公式 15 カメラコマンド（H3 とは別） |
| `server/grok/guides/pixverse.ts` | PixVerse V6（50–80語・3文） |
| `server/grok/guides/happyhorse.ts` | HappyHorse `[Image N]` / `characterN` |
| `server/grok/guides/grok-imagine.ts` | Grok Imagine 短い監督文 |
| `server/grok/guides/seedream.ts` | Seedream 被写体先頭・引用テキスト |
| `server/grok/guides/flux.ts` | FLUX.2（ネガティブ禁止・hex） |
| `server/grok/guides/ideogram.ts` | Ideogram 自然文・文字引用 |
| `server/grok/guides/imagen.ts` | Imagen 写真英語（Nano Banana と分離） |
| `server/grok/guides/nano-banana.ts` | Google Nano Banana 監督ブリーフ |
| `server/grok/guides/gpt-image.ts` | GPT Image Scene→Subject→Details |
| `server/grok/guides/qwen.ts` | Qwen Image / CJK 引用 |
| `server/routes/optimize-prompt.ts` | HTTP（status / profile / optimize） |
| `src/components/PromptOptimizePanel.tsx` | UI |

## 挙動

- Grok CLI 未インストール / 利用不可 → **503 でよい**（必須依存ではない）
- ステータスは短時間キャッシュ（CLI 存在確認の連打を避ける）
- 最適化モデルはハードコードしない。実行前に `grok models` を呼び、CLI 既定（一覧に含まれるもの）を `-m` に渡す。CLI バージョンが変わるとキャッシュを捨てて取り直す
- `STUDIO_GROK_OPTIMIZE_MODEL` で上書き可。一覧に無い ID はエラー（`grok-build` のような旧エイリアスを固定しない）
- 最適化出力はマーカー（`<<<OPTIMIZED>>>` … `<<<END>>>`）で抽出
- モデル別プロファイルでルール Markdown と埋め込みガイドファイルを一時作業ディレクトリへ渡す
- `bytedance/seedance-2-5` は `seedance-2-5` 専用プロファイルへ解決し、2.0 系とガイドを分離する
- Seedance 2.5 では画像・動画・音声の素材役割、整数秒タイムライン、storyboard / keyframe / blockout、編集・延長のタスク別構造を優先する
- Seedance 2.5 の尺・比率・解像度などの生成パラメータは創作プロンプトへ混ぜない
- `minimax-h3/*` は `minimax-h3` 専用プロファイルへ解決する（`minimax/hailuo-02` など Hailuo は hailuo プロファイル＋公式 `[Push in]` カメラコマンド。H3 の3フィールドへ書き換えない）
- MiniMax H3 は公式の T2VA / I2VA / FL2VA / L2VA（3フィールド）と reference の6節構造を優先する
- MiniMax H3 では Studio の `@imageN` / `@VideoN` / `@AudioN` を維持し、同じ番号の `<Picture N>` / `<Video N>` / `<Audio N>` を併用する
- MiniMax H3 の不要 BGM は否定文ではなく `non_diegetic_music: N/A`
- `pixverse-v6/*` は `pixverse`（50–80語、カメラ1つ、肯定制約）
- `wan/2-7-image` / `image-pro` は `wan-image`。`wan/2-7-image-to-video` など動画は `wan`
- Wan 動画は Studio タグを残し、公式の `Image n` / `Video n` を同じ番号で併用する。台詞なしなら `No dialogue.`
- Kling 2.x は単ショット。3.0 だけマルチショットと話者付き台詞を使ってよい
- 構文が薄い family（recraft / topaz / z-image / elevenlabs / omnihuman / infinitalk / volcengine / gemini-omni-video など）は generic のまま

## 認証

`grok login` 済み、または `.env` の `XAI_API_KEY`。

## See Also

- [Getting Started](wiki://getting-started)
- [Frontend](wiki://frontend)
- [Server API](wiki://server-api)
