---
name: kiestudio-cli
description: >-
  KIE STUDIO CLI で IMAGE / VIDEO / AUDIO を生成し、Gallery 履歴を確認する。
  kiestudio generate / models / status / history / up / open を使うとき、
  ターミナルから Studio を操作するときに読む。
---

# kiestudio CLI

KIE STUDIO の生成は **Studio API** 経由のみ。kie.ai を直接叩かない。`/api/internal/agent/*` も使わない（デスクトップのトークンは外部 CLI から見えない）。

結果は SQLite 履歴に載り、既存 Gallery でピン・再利用・リトライ・詳細ができる。CLI 第一版に削除コマンドは無い。

## 前提

- `KIE_API_KEY`（`.env` または設定画面）
- Studio API が起動していること

```bash
kiestudio up          # API のみ（既に起動中なら何もしない）
npm run dev           # API + Web
```

接続先は `STUDIO_API_BASE`。未設定時は `127.0.0.1:8787-8806` の `/api/health` を探索する。

```bash
bun cli/index.ts --help
# または
npx kiestudio --help
npm run kiestudio -- --help
```

## コマンド

サブコマンドごとに `--help`（Examples 付き）。機械可読出力は `--json`。

```bash
kiestudio models --category image flux
kiestudio generate -m flux-kontext-pro -p "a red bicycle" --wait
kiestudio generate -m market/flux-kontext-pro --input '{"prompt":"hi","aspect_ratio":"16:9"}'
kiestudio generate -m flux-kontext-pro -p "hi" --set aspect_ratio=16:9 --json
kiestudio status <taskId> --wait
kiestudio history bicycle
kiestudio open
```

`generate` は **冪等ではない**。再実行すると別 `taskId` になる。

## 失敗と直し方

| 症状 | 対処 |
|------|------|
| Studio API が起動していません | `kiestudio up` または `npm run dev` |
| モデルが見つかりません / 複数ヒット | `kiestudio models <query>` で id を確認し `-m` に id を渡す |
| 必須フィールドが不足 | `--help` の例、または `--input '{"field":"..."}'` |
| Web UI に接続できません | `npm run dev` のあと `kiestudio open` |

## Gallery

```bash
kiestudio history              # taskId 確認
kiestudio open                 # UI でピン / 再利用 / 削除
```

フォーカスで Gallery が `GET /api/history` を merge する。見えないときは Studio ウィンドウをフォーカスする。
