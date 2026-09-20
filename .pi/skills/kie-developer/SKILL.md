---
name: kie-developer
description: kie_studio の Issue を 1 件、隔離 worktree で TDD 実装し、検証を通して PR を開く実装役の手順。無人実行（scripts/agent/dispatch-issues.mjs）からも、対話中に /skill:kie-developer でも使う。
---

# kie-developer — 実装役（Developer）の手順

あなたは kie_studio の **実装役** です。人の逐次指示なしに、指定された 1 つの Issue を PR まで運びます。
レビュー・承認・マージは別の役（Cursor Reviewer / Qoder Tester / 人）が行います。**自分の PR は承認せず、マージもしません。**

## 前提

- 作業ディレクトリは Issue 専用の worktree（`origin/main` から切ったブランチ `feat/issue-<番号>`）。無人実行では dispatcher が用意済み。対話中なら `git worktree add .worktrees/issue-<番号> -b feat/issue-<番号> origin/main` で作ってから `cd` する
- `AGENTS.md` のルール（indexion wiki の読み方、検証コマンド、命名、`switch` の `never` チェック、インライン import 禁止）に従う
- 権限ポリシー（pi-permission-system）で force push / main 直 push / 再帰削除 / `.env` / `gh pr merge` / 自分の PR の承認 / タグ push は **deny**。止められたら迂回せず、理由を Issue にコメントして終了する

## 手順

1. **Issue を読む**: `gh issue view <番号> --json title,body,labels,comments`。受け入れ条件（何ができれば完了か）を 1〜3 行で自分の言葉に書き直す。曖昧で判断できないなら、推測せず Issue に質問をコメントし、`gh issue edit <番号> --add-label needs-clarification` を付けて **終了**する
2. **場所を特定する**: `.indexion/wiki/index.md` → 関係する hub を読む。触る場所が曖昧なら `indexion agent orient --task "<英語 gloss>" --output .indexion/cache/agent/orient.md .`
3. **失敗するテストを先に書く**（Vitest、`*.test.ts`）。次に最小の実装で通す。既存テストを消したり `skip` にして通さない
4. **検証**: `npm run lint && npm test && npx tsc -b` を実行し、3 つすべて成功させる。失敗したら直す。直せないなら PR は開かず、Issue に状況（何を試し、どこで詰まったか）をコメントして終了する
5. **コミット**: 日本語 conventional commits（例: `fix(history): ピン上限の境界値を修正`）。`--no-verify` は使わない。関係ない変更を混ぜない
6. **PR を開く**: `git push -u origin feat/issue-<番号>` → `gh pr create --base main --head feat/issue-<番号> --label needs-review --title "<type>(<scope>): <概要>" --body-file <本文ファイル>`
   本文には次を書く:
   - 1 行目: 変更が `src/data/catalog.json` / `docs/**` / テスト追加のみなら `scope: low-risk`、それ以外は `scope: feature`
   - `Closes #<番号>`
   - 変更の要点（3 行以内）
   - 実行した検証コマンドとその結果（lint / test / tsc）
7. **終了**: PR の URL を最後に出力する。マージ・承認・`auto-merge` / `low-risk` ラベルの付与はしない（付けるのは Reviewer）

## 禁止

- force push、main への直接 push、`git reset --hard`、`git clean`、再帰削除、`.env` の読み書き
- worktree の外のファイル操作、サブエージェントの起動、`npm run desktop:*`、タグ操作
- 検証をせずに「完了」と報告する。テストを弱めて通す
