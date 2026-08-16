# 一覧と layered help

ルートと各サブコマンドの `--help` に Examples がある。`models` はカタログを表形式（または `--json`）で出す。

## Sub-features

- `root-help` — `kiestudio --help` がコマンド一覧と generate 例を含む
- `command-help` — `generate --help` が `-m` / `--wait` の例を含む
- `models-list` — `models` が 1 件以上。`--category image` で絞れる
- `models-json` — `--json` が `models` 配列の JSON

## How to get to it (user POV)

- `kiestudio --help`
- `kiestudio generate --help`
- `kiestudio models`
- `kiestudio models --category image --json`

## Driving it with CLI

Preconditions: Doctor 済み。API が応答し、カタログがある。

- ユーザーが使い方を知りたい
  - Command: `bun cli/index.ts --help`
  - Observe: exit 0、本文に `generate` と `kiestudio up`
- ユーザーが generate の例をコピーしたい
  - Command: `bun cli/index.ts generate --help`
  - Observe: exit 0、`-m flux-kontext-pro` を含む例がある
- ユーザーがモデルを探したい
  - Command: `bun cli/index.ts models --category image`
  - Observe: exit 0、1 行以上、各行に id と `image`
- ユーザーが JSON で一覧したい
  - Command: `bun cli/index.ts models --json`
  - Observe: exit 0、stdout が JSON で `models` を含む

## Gotchas

- カタログ未同期だと models が失敗または空。空なら sync が必要で、捏造カタログで合格にしない
- `--help` は API 無しでも exit 0
