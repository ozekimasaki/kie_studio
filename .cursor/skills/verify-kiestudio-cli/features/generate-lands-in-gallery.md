# generate の結果が Gallery 履歴に載る

`kiestudio generate` は `POST /api/generate` でタスクを作り、サーバーが `history_items` に upsert する。`kiestudio history` と同じ DB を Gallery が見る。

## Sub-features

- `generate-validation` — `-m` 無しや必須欠けは exit 1 と直し方の例
- `generate-help-no-key` — キー無し run は実課金せず、help / バリデーションまで
- `generate-history` — キーあり run で返った `taskId` が `history` に存在する

## How to get to it (user POV)

- `kiestudio generate --help`
- `kiestudio generate -m flux-kontext-pro`（必須欠け）
- `kiestudio generate -m <id> -p "..." --json`
- `kiestudio history`

## Driving it with CLI

Preconditions: Doctor 済み。

- ユーザーが必須欠けで失敗する
  - Command: `bun cli/index.ts generate -m flux-kontext-pro`
  - Observe: exit 1、stderr に必須フィールドまたはモデル解決のメッセージと例
  - モデル名がカタログに無い環境では `kiestudio models --category image` の先頭 id を `-m` に使う
- キーが無い (`hasKey: false`)
  - Command: `bun cli/index.ts generate --help`
  - Observe: exit 0。実 generate はスキップし、evidence に `skipped: no KIE_API_KEY` と書く
- キーがある (`hasKey: true`)
  - Command: `bun cli/index.ts generate -m <catalog-id> -p "kiestudio cli verify dot" --json`
  - Observe: exit 0、JSON に `taskId`
  - Second read: `bun cli/index.ts history --json`
  - Observe: 同じ `taskId` が `items` にある
  - 課金・レート制限で失敗したら stdout/stderr を残し、不合格ではなく境界エラーとして記録する（リトライしすぎない）

## Gotchas

- generate は冪等ではない。検証のたびに新しい taskId になる
- 一時 DB の run では Gallery UI を開かなくてよい。proof は `history` API で足りる
- 既存ユーザー API で実 generate するとその Gallery に残る。ユーザーに無断で大量生成しない
