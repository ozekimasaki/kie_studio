# Prompt Optimize

Grok CLI を使ったプロンプト最適化（`server/grok/` + UI `PromptOptimizePanel`）。

## モジュール

| ファイル | 役割 |
|----------|------|
| `server/grok/cli.ts` | Grok CLI 起動・タイムアウト・出力パース |
| `server/grok/optimize-profiles.ts` | モデル別最適化ルール / ガイドパス |
| `server/routes/optimize-prompt.ts` | HTTP（status / profile / optimize） |
| `src/components/PromptOptimizePanel.tsx` | UI |

## 挙動

- Grok CLI 未インストール / 利用不可 → **503 でよい**（必須依存ではない）
- ステータスは短時間キャッシュ（CLI 存在確認の連打を避ける）
- 最適化出力はマーカー（`<<<OPTIMIZED>>>` … `<<<END>>>`）で抽出
- モデル別プロファイルでルール Markdown とガイドファイルを渡す

## 認証

`grok login` 済み、または `.env` の `XAI_API_KEY`。

## See Also

- [Getting Started](wiki://getting-started)
- [Frontend](wiki://frontend)
- [Server API](wiki://server-api)
