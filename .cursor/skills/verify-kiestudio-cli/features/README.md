# kiestudio CLI verification map

CLI 面の検証ソース。Baseline のあと、対象 feature ファイルを recipe として使う。

## Baseline preconditions

- Doctor を先に通す（`.cursor/skills/verify-kiestudio-cli/SKILL.md`）
- 既存の健康な API があればそれを使う。無ければ一時 `STUDIO_DB_PATH` で API を起動した run だけを運転する
- ユーザーの `data/studio.db` やデスクトップ userData を消さない
- 実 generate は `/api/health` の `hasKey: true` のときだけ

## Driving conventions

- コマンドはリテラル。`bun cli/index.ts` を使う（`npx kiestudio` でも可）
- 引用符とフラグを変えない
- 証明はコマンド + stdout/stderr/exit。mutation は `history` または `GET /api/history` の第二読取

## Features

- [up-and-doctor.md](up-and-doctor.md) — API 探索と起動判定
- [models-and-help.md](models-and-help.md) — 一覧と layered `--help`
- [generate-lands-in-gallery.md](generate-lands-in-gallery.md) — generate の `taskId` が history に載る
