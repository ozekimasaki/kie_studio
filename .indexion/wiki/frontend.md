# Frontend

React UI。入口は `src/main.tsx` → `src/App.tsx`。IMAGE / VIDEO / AUDIO を同じ Studio shell で扱う。

## 主な UX

- 最初に用途、次にモデル。検索・お気に入り・最近使用・提供元フィルターを持つ
- OpenAPI 制約（必須、文字数、数値、参照数、容量、尺、相互排他）を送信前に表示
- Quick Action は入力を復元するだけで、自動送信・自動課金しない
- 未送信 / API受付済み / 生成中を分離し、未送信だけキャンセル可能
- 402 / 400 / 413 / 429 / 531 を購入、入力修正、再送、残高再取得へ分類

## AUDIO

| コンポーネント | 役割 |
|------|------|
| `components/audio/AudioEditors.tsx` | 会話の話者行、ナレーションのセグメント編集 |
| `components/audio/AudioPlayer.tsx` | 画面移動で切れない単一ミニプレイヤー、Media Session |
| `SunoStyleAssist` | 原文と改善案の比較・適用・取り消し |
| `HistorySheets` | 波形、同期歌詞、区間選択、Persona、Suno編集 |

自動再生と操作効果音は使わない。複数候補は同一生成グループのトラックとして扱う。

## VIDEO / history

Runway Aleph は親タスクと Before/After を表示。動画と音声の両方があるときだけリップシンクを提示する。履歴詳細は provider 状態、送信 parameter、元 response、error をコピーできる。

## 軽量化

履歴段階描画、動画 Intersection Observer、遅延ロード、経過時間別 polling、terminal 時中心の SQLite 永続化を維持する。

## See Also

- [Core Concepts](wiki://core-concepts)
- [Client Lib](wiki://client-lib)
- [Architecture](wiki://architecture)
