# Prompt Optimize

Grok CLI を使ったプロンプト最適化（`server/grok/` + UI `PromptOptimizePanel`）。

## モジュール

| ファイル | 役割 |
|----------|------|
| `server/grok/cli.ts` | Grok CLI 起動・タイムアウト・出力パース |
| `server/grok/optimize-profiles.ts` | モデル別最適化ルール / 埋め込みガイド選択 |
| `server/grok/guides/seedance.ts` | Seedance 2.0 系の埋め込みガイド |
| `server/grok/guides/seedance-2-5.ts` | BytePlus / Dreamina 公式ガイドと `sd25-pe` skill に基づく Seedance 2.5 専用ガイド |
| `server/routes/optimize-prompt.ts` | HTTP（status / profile / optimize） |
| `src/components/PromptOptimizePanel.tsx` | UI |

## 挙動

- Grok CLI 未インストール / 利用不可 → **503 でよい**（必須依存ではない）
- ステータスは短時間キャッシュ（CLI 存在確認の連打を避ける）
- 最適化出力はマーカー（`<<<OPTIMIZED>>>` … `<<<END>>>`）で抽出
- モデル別プロファイルでルール Markdown と埋め込みガイドファイルを一時作業ディレクトリへ渡す
- `bytedance/seedance-2-5` は `seedance-2-5` 専用プロファイルへ解決し、2.0 系とガイドを分離する
- Seedance 2.5 では画像・動画・音声の素材役割、整数秒タイムライン、storyboard / keyframe / blockout、編集・延長のタスク別構造を優先する
- Seedance 2.5 の尺・比率・解像度などの生成パラメータは創作プロンプトへ混ぜない

## 認証

`grok login` 済み、または `.env` の `XAI_API_KEY`。

## See Also

- [Getting Started](wiki://getting-started)
- [Frontend](wiki://frontend)
- [Server API](wiki://server-api)
