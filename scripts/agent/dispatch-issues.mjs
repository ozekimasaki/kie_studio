#!/usr/bin/env node
// dispatch-issues.mjs — `autonomous` ラベルの Issue を拾い、隔離 worktree で pi（実装役）を無人起動する。
//
// pi-reactor は Windows で Unix ソケットを開けず動かないため、同じ役割をこのスクリプト +
// タスクスケジューラ（15 分ごと）で担う。判断は pi に、機械的な手順（worktree 作成・npm ci・
// タイムアウト・ラベル遷移・記録）はここに置く。
//
// 使い方（タスクスケジューラ / 手動）:
//   node scripts/agent/dispatch-issues.mjs [--once] [--dry-run] [--issue N]
// 環境変数:
//   KIE_AGENT_REPO        既定 ozekimasaki/kie_studio
//   KIE_AGENT_MODEL       既定 openai-codex/gpt-5.6-luna（pi の provider/model）
//   KIE_AGENT_MAX_MINUTES 既定 30
//   KIE_AGENT_DAILY_CAP   既定 4（1 日の起動回数上限）
//   KIE_AGENT_PI          pi 実行ファイル。既定は node と同じディレクトリの pi.cmd
//   KIE_AGENT_HOME        記録の置き場。既定 ~/.kie-agent
//
// 記録: ~/.kie-agent/runs.jsonl（1 行 1 実行）、~/.kie-agent/logs/<日時>-issue-<N>.log

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO = process.env.KIE_AGENT_REPO || "ozekimasaki/kie_studio";
const MODEL = process.env.KIE_AGENT_MODEL || "openai-codex/gpt-5.6-luna";
const MAX_MINUTES = Number(process.env.KIE_AGENT_MAX_MINUTES || 30);
const DAILY_CAP = Number(process.env.KIE_AGENT_DAILY_CAP || 4);
const HOME = process.env.KIE_AGENT_HOME || join(homedir(), ".kie-agent");
const LOG_DIR = join(HOME, "logs");
const RUNS_FILE = join(HOME, "runs.jsonl");
const LOCK_FILE = join(HOME, "dispatcher.lock");
const CHARTER = join(ROOT, ".pi", "skills", "kie-developer", "SKILL.md");
const WORKTREES = join(ROOT, ".worktrees");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const onlyIssueArg = process.argv.indexOf("--issue");
const ONLY_ISSUE = onlyIssueArg >= 0 ? Number(process.argv[onlyIssueArg + 1]) : null;

const SKIP_LABELS = new Set(["in-progress", "needs-review", "needs-clarification"]);

function log(msg) {
  const line = `${new Date().toISOString()} ${msg}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, "dispatcher.log"), `${line}\n`, "utf8");
  } catch {
    // noop
  }
}

// shell を介さずに起動する（引数のクォート崩れを避ける）。gh / git / taskkill は実行ファイル、
// npm と pi は Node 同梱・同ディレクトリの JS エントリを node で直接起動する。
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", windowsHide: true, ...opts });
  if (r.error) throw r.error;
  return r;
}

function must(cmd, cmdArgs, opts = {}) {
  const r = run(cmd, cmdArgs, opts);
  if (r.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} failed (${r.status}): ${(r.stderr || r.stdout || "").trim()}`);
  }
  return r.stdout;
}

const NODE_DIR = dirname(process.execPath);

// npm-cli.js は Node 同梱。node で直接起動する（npm.cmd を shell 経由で呼ばない）
function npmArgs(...rest) {
  const cli = join(NODE_DIR, "node_modules", "npm", "bin", "npm-cli.js");
  if (existsSync(cli)) return [process.execPath, [cli, ...rest]];
  return [process.platform === "win32" ? "npm.cmd" : "npm", rest];
}

// pi は `npm i -g` で node と同じディレクトリに入る。KIE_AGENT_PI で JS エントリを上書き可
function piCommand(...rest) {
  const explicit = process.env.KIE_AGENT_PI;
  if (explicit) return explicit.endsWith(".js") ? [process.execPath, [explicit, ...rest]] : [explicit, rest];
  const cli = join(NODE_DIR, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js");
  if (existsSync(cli)) return [process.execPath, [cli, ...rest]];
  return [process.platform === "win32" ? "pi.cmd" : "pi", rest];
}

function todayRuns() {
  if (!existsSync(RUNS_FILE)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return readFileSync(RUNS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((r) => r.startedAt && r.startedAt.startsWith(today)).length;
}

function recordRun(record) {
  mkdirSync(HOME, { recursive: true });
  appendFileSync(RUNS_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

function acquireLock() {
  mkdirSync(HOME, { recursive: true });
  if (existsSync(LOCK_FILE)) {
    const pid = Number(readFileSync(LOCK_FILE, "utf8").trim());
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      alive = false;
    }
    if (alive) return false;
    log(`stale lock (pid ${pid}) removed`);
  }
  writeFileSync(LOCK_FILE, String(process.pid), "utf8");
  return true;
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // noop
  }
}

function listCandidates() {
  const out = must("gh", [
    "issue", "list", "--repo", REPO, "--label", "autonomous", "--state", "open",
    "--json", "number,title,labels,updatedAt", "--limit", "20",
  ]);
  const issues = JSON.parse(out || "[]");
  return issues
    .filter((i) => !i.labels.some((l) => SKIP_LABELS.has(l.name)))
    .filter((i) => (ONLY_ISSUE ? i.number === ONLY_ISSUE : true))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

function remoteBranchExists(branch) {
  const r = run("git", ["-C", ROOT, "ls-remote", "--heads", "origin", branch]);
  return r.status === 0 && r.stdout.trim().length > 0;
}

function prForBranch(branch) {
  const r = run("gh", ["pr", "list", "--repo", REPO, "--head", branch, "--state", "all", "--json", "number,url,state", "--limit", "1"]);
  if (r.status !== 0) return null;
  const arr = JSON.parse(r.stdout || "[]");
  return arr[0] || null;
}

function prepareWorktree(issueNumber) {
  const branch = `feat/issue-${issueNumber}`;
  const dir = join(WORKTREES, `issue-${issueNumber}`);
  must("git", ["-C", ROOT, "fetch", "--quiet", "origin", "main"]);
  if (existsSync(dir)) {
    log(`worktree ${dir} already exists; reusing`);
  } else {
    mkdirSync(WORKTREES, { recursive: true });
    run("git", ["-C", ROOT, "worktree", "prune"]);
    // 前回の中断で残ったローカルブランチ（リモートには無い）を掃除してから切り直す
    const stale = run("git", ["-C", ROOT, "branch", "--list", branch]).stdout.trim();
    if (stale) {
      log(`stale local branch ${branch} found; deleting`);
      must("git", ["-C", ROOT, "branch", "-D", branch]);
    }
    must("git", ["-C", ROOT, "worktree", "add", "--quiet", "-b", branch, dir, "origin/main"]);
  }
  log(`npm ci in ${dir}`);
  const [npmCmd, npmCliArgs] = npmArgs("ci", "--no-audit", "--no-fund", "--loglevel=error");
  must(npmCmd, npmCliArgs, { cwd: dir, maxBuffer: 64 * 1024 * 1024 });
  return { branch, dir };
}

function buildPrompt(issue) {
  return [
    `Issue #${issue.number}「${issue.title}」を担当してください（repo: ${REPO}）。`,
    "system prompt に付けた kie-developer の手順に従い、この worktree（カレントディレクトリ）の中だけで作業し、",
    `ブランチ feat/issue-${issue.number} に commit して PR を開いたら PR の URL を最後に 1 行で出力して終了してください。`,
    "受け入れ条件が曖昧なら needs-clarification を付けて終了、検証が通らなければ PR を開かず Issue にコメントして終了してください。",
  ].join("\n");
}

function runPi(issue, dir) {
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = join(LOG_DIR, `${stamp}-issue-${issue.number}.log`);
    mkdirSync(LOG_DIR, { recursive: true });
    const [pi, piArgs] = piCommand("-p", "--model", MODEL, "--append-system-prompt", CHARTER, buildPrompt(issue));
    log(`spawn pi (${pi} ${piArgs[0]}) for #${issue.number} in ${dir}, timeout ${MAX_MINUTES}m, log ${logFile}`);
    // stdin は閉じて渡す。pipe のままだと pi -p が stdin の EOF を待って起動直後に止まる（2026-09-20 実測）
    const child = spawn(pi, piArgs, {
      cwd: dir,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });
    let output = "";
    const sink = (chunk) => {
      const text = chunk.toString();
      output += text;
      appendFileSync(logFile, text, "utf8");
    };
    child.stdout.on("data", sink);
    child.stderr.on("data", sink);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`timeout: killing pi tree for #${issue.number}`);
      if (process.platform === "win32") run("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
      else child.kill("SIGKILL");
    }, MAX_MINUTES * 60 * 1000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, timedOut, output, logFile, durationSec: Math.round((Date.now() - started) / 1000) });
    });
  });
}

function label(issueNumber, add, remove) {
  const a = add.length ? ["--add-label", add.join(",")] : [];
  const r = remove.length ? ["--remove-label", remove.join(",")] : [];
  const res = run("gh", ["issue", "edit", String(issueNumber), "--repo", REPO, ...a, ...r]);
  if (res.status !== 0) log(`label update failed for #${issueNumber}: ${(res.stderr || "").trim()}`);
}

function comment(issueNumber, body) {
  const file = join(HOME, `comment-${issueNumber}.md`);
  writeFileSync(file, body, "utf8");
  const res = run("gh", ["issue", "comment", String(issueNumber), "--repo", REPO, "--body-file", file]);
  if (res.status !== 0) log(`comment failed for #${issueNumber}: ${(res.stderr || "").trim()}`);
}

async function handleIssue(issue) {
  const branch = `feat/issue-${issue.number}`;
  if (remoteBranchExists(branch)) {
    log(`#${issue.number}: remote branch ${branch} already exists; skipping`);
    return "skipped";
  }
  if (DRY_RUN) {
    log(`[dry-run] would dispatch #${issue.number} "${issue.title}"`);
    return "dry-run";
  }
  const startedAt = new Date().toISOString();
  label(issue.number, ["in-progress"], []);
  let outcome = "failed";
  let prUrl = null;
  let result = null;
  try {
    const { dir } = prepareWorktree(issue.number);
    result = await runPi(issue, dir);
    const pr = prForBranch(branch);
    if (pr) {
      outcome = "pr-opened";
      prUrl = pr.url;
      label(issue.number, ["needs-review"], ["in-progress"]);
      run("git", ["-C", ROOT, "worktree", "remove", "--force", dir]);
    } else {
      const fresh = JSON.parse(must("gh", ["issue", "view", String(issue.number), "--repo", REPO, "--json", "labels"]));
      const clarifying = fresh.labels.some((l) => l.name === "needs-clarification");
      outcome = result.timedOut ? "timeout" : clarifying ? "needs-clarification" : "no-pr";
      label(issue.number, [], ["in-progress"]);
      if (!clarifying) {
        comment(
          issue.number,
          `実装役（pi）が PR を開けずに終了しました（${outcome}、${result.durationSec}s）。ログは実行マシンの \`${result.logFile}\` を確認してください。worktree は \`${dir}\` に残しています。`,
        );
      }
    }
  } catch (err) {
    outcome = "error";
    label(issue.number, [], ["in-progress"]);
    log(`#${issue.number}: ${err.message}`);
  }
  recordRun({
    startedAt,
    finishedAt: new Date().toISOString(),
    issue: issue.number,
    title: issue.title,
    outcome,
    prUrl,
    durationSec: result ? result.durationSec : null,
    logFile: result ? result.logFile : null,
    model: MODEL,
  });
  log(`#${issue.number}: ${outcome}${prUrl ? ` ${prUrl}` : ""}`);
  return outcome;
}

async function main() {
  if (!existsSync(CHARTER)) {
    log(`charter not found at ${CHARTER}; harness not merged into this checkout yet. Nothing to do.`);
    return;
  }
  if (run("gh", ["auth", "status"]).status !== 0) {
    log("gh is not authenticated; aborting");
    return;
  }
  if (!acquireLock()) {
    log("another dispatcher run is active; exiting");
    return;
  }
  try {
    const used = todayRuns();
    if (used >= DAILY_CAP) {
      log(`daily cap reached (${used}/${DAILY_CAP}); exiting`);
      return;
    }
    const candidates = listCandidates();
    log(`candidates: ${candidates.map((c) => `#${c.number}`).join(", ") || "(none)"}`);
    // 1 tick に 1 件。並列にしない（CI とレビューの負荷を一定に保つ）
    for (const issue of candidates) {
      const outcome = await handleIssue(issue);
      if (outcome !== "skipped") break;
    }
  } finally {
    releaseLock();
  }
}

main().catch((err) => {
  log(`fatal: ${err && err.stack ? err.stack : String(err)}`);
  releaseLock();
  process.exitCode = 1;
});
