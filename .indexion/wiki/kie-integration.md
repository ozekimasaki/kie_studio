# Kie Integration

kie.ai Market / Upload へのサーバー側クライアント（`server/kie/`）。

## モジュール

| ファイル | 役割 |
|----------|------|
| `client.ts` | `kieFetch`・`KieApiError`・`assertKieOk` |
| `market.ts` | `createTask` / `recordInfo`（正規化タスク） |
| `upload.ts` | File Upload API |
| `common.ts` | 共通ヘルパ |
| `safe.ts` | 安全なパース・検証 |
| `types.ts` | サーバー側タスク型（フロント型と対応） |

## 認証

`KIE_API_KEY` を Authorization ヘッダ等で付与（フロントには渡さない）。

## Market フロー

1. `createTask({ model, input })` → `taskId`
2. `recordInfo(taskId)` → `NormalizedTask`（state / resultJson / fail / credits）

結果 JSON や状態文字列のゆれは `market.ts` / `safe.ts` 側で正規化する。

## See Also

- [Server API](wiki://server-api)
- [Architecture](wiki://architecture)
- [Core Concepts](wiki://core-concepts)
