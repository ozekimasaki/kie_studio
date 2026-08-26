# Pre-release チェックリスト

リリース（canary / stable）や大きめの PR マージ前に通す手順。エージェント作業の完了条件にも使う。

## 1. コードゲート

```bash
npm run lint && npm test && npx tsc -b
```

フロント／デスクトップを触った場合は必要に応じて:

```bash
npm run build
```

## 2. 機能スモーク

今回の変更面だけを手で確認する。例:

- エージェント Grok: Settings → LLM → xAI Grok に `XAI_API_KEY` を保存 → モデルピッカーに「xAI Grok」
- プロンプト最適化の Grok CLI（`server/grok/`）は別経路。`grok login` または同じ `XAI_API_KEY`

## 3. UI/UX ゲート（崩れ・被り）

対象画面を目視する（狭い幅・各状態）:

1. 要素の重なり・はみ出しがない
2. シート／モーダル内でスクロールと折り返しが破綻しない
3. ボタン群が重ならない
4. SpringSheet / FloatingChrome など既存 chrome と z-index が競合しない
5. [DESIGN.md](../DESIGN.md) 準拠（生 hex・glow・紫グラデ禁止、`var(--*)`）

問題があれば同 PR で直してから次へ進む。

## 4. デスクトップ（任意）

```bash
npm run desktop:dev
# または canary ビルド
```

Settings まで到達し、今回の UI が webview でも問題ないことを確認する。

## 5. 知識同期

関係する indexion wiki を更新する（`.md` 直編集禁止 — `pages update` 経由）:

```bash
indexion wiki pages update --wiki-dir=.indexion/wiki ...
indexion wiki lint --wiki-dir=.indexion/wiki
```

## 6. 入口ドキュメント

実装と手順に合わせて更新する（詳細の正は wiki / 本ファイル）:

1. [AGENTS.md](../AGENTS.md)（ディレクトリ・注意・Pre-release リンク）
2. [README.md](../README.md) / [README.ja.md](../README.ja.md)（必要なら [README.zh.md](../README.zh.md)）

順序は **AGENTS → README**。横断で文言が食い違わないこと。

## 7. Git

- コミットメッセージは日本語 conventional commits（[AGENTS.md](../AGENTS.md) 参照）
- push / tag はユーザーが明示したときのみ
- `v*-canary` 等は既存 `.github/workflows/release.yml` に従う

## 8. 禁止

次を成果物・コミットに含めない:

- `.env` / API キー
- 旧 `data/grok-oauth/auth.json`（廃止済み。残っていてもコミットしない）
- `*.db` / `*.key`
