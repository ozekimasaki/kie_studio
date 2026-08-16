---
name: verify-kiestudio-cli
description: >-
  kiestudio CLI を起動・診断し、models / help / generate→history を実コマンドで証明する。
  CLI 面の動作確認、Gallery に taskId が載ることの検証に使う。Web UI 全体は対象外。
---

# verify-kiestudio-cli

CLI 面だけを検証する。Web UI のクリック操作はこの skill の範囲外。

Proof の置き場: `/tmp/kiestudio-cli-verify-<runId>/`（cleanup しても残す）。

## Launch

1. `GET http://127.0.0.1:8787/api/health`（必要なら 8788–8806）を試す。
2. `ok: true` なら **既存 API を使う**。ユーザーの `studio.db` は消さない。
3. 無ければ一時 DB で API だけ起動する:

```bash
RUN_ID=$(date +%s)
EVIDENCE=/tmp/kiestudio-cli-verify-$RUN_ID
mkdir -p "$EVIDENCE"
export STUDIO_DB_PATH="$EVIDENCE/studio.db"
export SYNC_MODELS_ON_START=0
bun server/index.ts
```

Ready: ログに `KIE STUDIO API listening` が出る、または `/api/health` が 200。

この run が起動したプロセスの PID を `$EVIDENCE/api.pid` に書く。既存 API を借りた場合は pid ファイルを作らない。

## Doctor

既存・一時どちらでも、証明の前に一度だけ:

```bash
curl -sS http://127.0.0.1:8787/api/health
bun cli/index.ts models
```

合格:

- health が `{ "ok": true, ... }`
- `models` が 0 件でない（カタログ未同期なら `npm run sync:models` が前提。この skill はカタログを捏造しない）
- health の `hasKey` で実 generate できるか判断する

`bun cli/index.ts models` が「Studio API が起動していません」なら Launch に戻る。共有中のユーザー DB を `rm` しない。

## Drive

実コマンドのみ。ヘルパを新しく作らない。feature map を先に読む。

- 課金 generate は health `hasKey: true` のときだけ `features/generate-lands-in-gallery.md` を実行する
- キーが無い run は generate のバリデーション失敗と `--help` まで。スキップ理由を evidence に書く

## Evidence

各ステップで残す:

- 実行したコマンド
- stdout / stderr / exit code（ファイルにリダイレクト）
- キーあり generate では `taskId` と `bun cli/index.ts history` または `GET /api/history` にその id があること

## Cleanup

- `$EVIDENCE/api.pid` があるときだけ、その PID を止める
- 既存 API は止めない
- `$EVIDENCE` の proof は削除しない
- `STUDIO_DB_PATH` が `$EVIDENCE/studio.db` のときだけその DB を残してよい（proof）。ユーザーの `data/studio.db` は触らない

## Helpers

追加スクリプトは無い。起動は `bun server/index.ts`、操作は `bun cli/index.ts`。

## Feature map

[features/README.md](features/README.md)
