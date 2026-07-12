# Frontend

React UI。エントリは `src/main.tsx` → `src/App.tsx`。

## Visual system

**Precision Light**（`DESIGN.md`）— 明るい編集室。ソリッド面 + teal-ink アクセント（OKLCH）。Apple 風ガラス / radial 背景は廃止。

- トークン: `src/index.css`（primitive → semantic → `studio-*`）
- シェル: `h-dvh` 2ペイン（左フォーム ~380–440px / 右ギャラリー）。モバイルは `45dvh` / `1fr` で独立スクロール
- マテリアル: ソリッドのみ。blur は sticky CTA 等の限定用途
- モーション: 高頻度 UI は無/極短。シート・SharedMedia のみ intentional（bounce 0）。SpringSheet は focus trap + フォーカス復帰

## UX ガード（2026-07 更新）

- 検証失敗時は先頭エラーへ scroll/focus
- `formError` / 通知は `role="alert"` / `aria-live`
- モデル・カテゴリ切替は dirty 確認。生成中は CategoryTabs 無効
- 履歴 reuse はフォーム側に status 通知
- 成功シートの自動オープンは単発送信時のみ（ポーリングでは開かない）
- ReferenceUpload のラベルは hidden file input に紐づく

## 主要コンポーネント

| コンポーネント | 役割 |
|----------------|------|
| `CategoryTabs` | image / video 切替（セグメント・矢印キー・layout spring） |
| `ModelSelect` | カタログからモデル選択 |
| `DynamicForm` | スキーマ駆動フォーム・バリデーション・デフォルト値（`studio-label` / divide-y） |
| `ReferenceUpload` | 参照メディアアップロード |
| `PromptSnippets` | よく使うフレーズ挿入（折りたたみ） |
| `PromptOptimizePanel` | Grok 最適化 UI（折りたたみ既定） |
| `HistoryGallery` | 履歴・ピン・再試行・エクスポート（メディアファースト tile・二次操作はメニュー） |
| `CreditBadge` | 残高表示 |
| `KlingElementsEditor` | Kling Elements 専用入力（divide-y、送信前バリデーション） |

## シェル / モーション

| パス | 役割 |
|------|------|
| `components/shell/StudioShell` | レイアウト枠（IA: 左作成 · 右ギャラリー） |
| `components/shell/FloatingChrome` | ヘッダー |
| `components/motion/*` | Pressable / Material / SpringSheet / SharedMedia |
| `lib/motion.ts` | モーション定数 |

## App の責務

- モデル取得（TanStack Query）
- フォーム状態・生成 mutation
- 履歴の load / save / merge / pin
- ペンディングタスクのポーリング（`UNKNOWN_STALE_MS` / `PENDING_STALE_MS`）
- 履歴からの入力復元（未知キー破棄）

## See Also

- [Core Concepts](wiki://core-concepts)
- [Client Lib](wiki://client-lib)
- [Prompt Optimize](wiki://prompt-optimize)
- [Architecture](wiki://architecture)
