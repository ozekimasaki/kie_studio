---
name: kiestudio-cli-maintain
description: >-
  kiestudio CLI、POST /generate の履歴記録、PUT 履歴 upsert、Gallery の server merge
  を変更するときに読む。履歴の全置換や内部エージェント API 依存を戻さない。
---

# kiestudio CLI を触るとき

CLI は HTTP クライアントだけ。履歴の正本は SQLite（`history_items`）。Gallery と CLI は同じ Studio API を共有する。

## 層

```text
cli/          → POST /api/generate, GET /api/task, GET /api/history
server/routes → recordCreatedTask / mirrorTaskIntoHistory / upsert（削除しない）
server/db     → studio.db
src/lib       → mergeServerHistory（フォーカス時に Gallery へ）
```

## 触るファイル

| 目的 | パス |
|------|------|
| コマンド | `cli/main.ts`, `cli/help.ts`, `cli/client.ts` |
| 生成の履歴記録 | `server/db/recordTask.ts`, `server/routes/generate.ts`, `server/routes/task.ts` |
| 履歴 API | `server/db/history.ts`, `server/routes/history.ts` |
| Gallery merge | `src/lib/history.ts` (`mergeServerHistory`), `src/lib/useHistoryState.ts` |
| クライアント | `src/lib/api.ts` (`deleteHistoryItem`, `clearUnpinnedHistory`) |

エージェント内部 API（`server/routes/agentInternal.ts`）は同じ `recordCreatedTask` / `mirrorTaskIntoHistory` を使う。トークン付き内部経路を CLI の正本にしない。

## やってはいけないこと

- `PUT /api/history` を `DELETE FROM history_items` の全置換に戻す（CLI 件が消える）
- 削除を PUT の欠落で表現する。削除は `DELETE /api/history/:taskId` と `POST /api/history/clear-unpinned` のみ
- 終端状態（success / fail / partial / expired）を waiting/generating で上書きする
- CLI から `/api/internal/agent/*` や kie.ai を直接叩く
- CLI 専用の別 SQLite を持つ

## 検証

```bash
npm run lint && npm test && npx tsc -b
```

CLI の動作証明は `verify-kiestudio-cli` skill。利用手順は `kiestudio-cli` skill。
