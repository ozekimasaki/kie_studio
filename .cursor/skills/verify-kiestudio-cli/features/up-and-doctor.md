# API 探索と起動判定

`kiestudio up` は API が既に応答していれば何もしない。未起動なら `bun server/index.ts` 相当を前面起動する。

## Sub-features

- `health-discover` — 8787–8806 の `/api/health` で接続先を決める
- `up-noop` — 起動済みなら exit 0 で base URL を出す
- `up-missing-hint` — 未起動の models/generate は `kiestudio up` を案内して exit 1

## How to get to it (user POV)

- ターミナルで `kiestudio up`
- API 無しで `kiestudio models`

## Driving it with CLI

Preconditions: Launch / Doctor 済み。既存 API を借りている場合は `up` が no-op になることだけ確認する。

- ユーザーが API の有無を知りたい
  - Command: `bun cli/index.ts up`
  - Observe: exit 0。起動済みなら stdout に `http://127.0.0.1:` を含む
- ユーザーが未起動のまま一覧したい
  - 一時的に API を止めた run でのみ: `bun cli/index.ts models`
  - Observe: exit 1、stderr に `kiestudio up` と `npm run dev`
  - 共有中のユーザー API は止めない。この枝は一時 API を自分で起動した run だけでよい

## Gotchas

- デスクトップは 8787 が埋まると次のポートを使う。Doctor の探索と CLI の探索は同じ範囲
- 他人の API を kill しない
