#!/usr/bin/env node
// guard-shell.mjs — コーディングエージェントの危険なシェルコマンドを「止める」hook。
//
// 使い方:
//   node guard-shell.mjs --cursor   Cursor beforeShellExecution（stdin: {command, cwd}）
//                                   → stdout に {permission: "deny"|"allow"} を返す
//   node guard-shell.mjs --qoder    Qoder / Claude Code 系 PreToolUse
//                                   （stdin: {tool_name, tool_input: {command}}）
//                                   → deny 時は stderr に理由を書いて exit 2
//
// ブロックした内容は ~/.cursor/hooks/blocked.log（--qoder は ~/.qoder/hooks/blocked.log）
// に追記する。再診断のときに「実際に止めた」証拠になる。
// 依存は Node 標準モジュールのみ。Windows / Linux（Cloud Agent）両対応。

import { appendFileSync, mkdirSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const MODE = process.argv.includes("--qoder") || process.argv.includes("--claude") ? "qoder" : "cursor";

// 1 セグメント（; & | で区切った1コマンド）に対して評価する。
// [^|;&]* は「同じセグメント内」を意味する。
const RULES = [
  {
    id: "git-force-push",
    re: /\bgit\s+push\b[^|;&]*?(\s--force(-with-lease)?\b|\s-[a-zA-Z]*f[a-zA-Z]*(\s|$)|\s\+\S+)/i,
    reason: "force push は禁止。履歴を壊す操作は人が手で行う。",
  },
  {
    id: "git-push-main",
    re: /\bgit\s+push\b[^|;&]*(\s(origin|upstream)\s+(main|master)\b|\bHEAD:(refs\/heads\/)?(main|master)\b)/i,
    reason: "main への直接 push は禁止。ブランチを push して PR を開く。",
  },
  {
    id: "git-destructive",
    re: /\bgit\s+(reset\s+--hard|clean\s+-[a-zA-Z]*[fdx]|push\b[^|;&]*--delete|checkout\s+--\s+\.\s*$|restore\s+\.\s*$)/i,
    reason: "作業ツリーや履歴を破棄する git 操作は禁止。",
  },
  {
    // -D（強制削除）だけ止める。-d は未マージなら git 自身が拒否するので許す（大文字小文字を区別）
    id: "git-branch-force-delete",
    re: /\bgit\s+branch\s+(-D|--delete\s+--force|--force\s+--delete)\b/,
    reason: "ブランチの強制削除は禁止。マージ済みなら -d を使う。",
  },
  {
    id: "git-no-verify",
    re: /\bgit\s+(commit|push|merge)\b[^|;&]*--no-verify\b/i,
    reason: "--no-verify で検証を飛ばさない。",
  },
  {
    id: "rm-rf",
    re: /(^|[\s;&|(])rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|-r\s+-f|-f\s+-r|--recursive\s+--force|--force\s+--recursive)\b/i,
    reason: "rm -rf は禁止。削除は対象を明示して人が確認する。",
  },
  {
    id: "rm-rf-powershell",
    re: /\b(Remove-Item|ri|rm|del|erase|rmdir|rd)\b[^|;&]*(-Recurse\b[^|;&]*-Force\b|-Force\b[^|;&]*-Recurse\b|\s\/s\b[^|;&]*\s\/q\b|\s\/q\b[^|;&]*\s\/s\b)/i,
    reason: "再帰・強制削除は禁止。削除は対象を明示して人が確認する。",
  },
  {
    id: "delete-studio-db",
    re: /\b(rm|del|erase|unlink|Remove-Item|ri)\b[^|;&]*studio\.db/i,
    reason: "studio.db（ユーザーの履歴 DB）は削除しない。",
  },
  {
    id: "sql-drop",
    re: /\bDROP\s+(TABLE|DATABASE|SCHEMA)\b/i,
    reason: "DROP 文は禁止。",
  },
  {
    id: "gh-pr-merge",
    re: /\bgh\s+pr\s+merge\b/i,
    reason: "エージェントは PR をマージしない。マージは auto-merge（CI + 承認）か人が行う。",
  },
  {
    id: "gh-repo-delete",
    re: /\bgh\s+repo\s+(delete|archive)\b/i,
    reason: "リポジトリの削除・アーカイブは禁止。",
  },
  {
    id: "gh-protection-tamper",
    re: /\bgh\s+api\b(?=[^|;&]*(-X|--method)\s*(DELETE|PUT|PATCH|POST)\b)(?=[^|;&]*(\/protection\b|\/rulesets\b|\/hooks\b|allow_auto_merge))/i,
    reason: "branch protection / rulesets / webhook の変更は禁止。ゲートは人だけが触る。",
  },
  {
    id: "remote-code-exec",
    re: /\b(curl|wget|irm|iwr|Invoke-RestMethod|Invoke-WebRequest)\b[^|;&]*\|\s*(sh|bash|zsh|iex|Invoke-Expression|pwsh|powershell|node|python[0-9.]*)\b|\b(iex|Invoke-Expression)\s*\(?\s*\(?\s*(irm|iwr|Invoke-RestMethod|Invoke-WebRequest)\b/i,
    reason: "ダウンロードしたスクリプトの直接実行は禁止。",
  },
  {
    id: "npm-publish",
    re: /\bnpm\s+publish\b|\bbun\s+publish\b/i,
    reason: "公開は人が行う。",
  },
];

// .env 系（秘密ファイル）の参照。存在確認だけは許す。
const ENV_TOKEN = /(^|[/\\])\.env(\.(?!example|sample|template)[\w.-]+)?$/i;
const ENV_ALLOWED_HEAD = /^(ls|dir|Test-Path|test|\[|stat|Get-Item|gi|Get-ChildItem|gci|find|fd|git)$/i;

function stripQuotes(t) {
  return t.replace(/^["']+|["']+$/g, "");
}

function checkEnvSecret(segment) {
  const tokens = segment.trim().split(/\s+/);
  if (tokens.length === 0) return null;
  const head = stripQuotes(tokens[0]);
  const hasEnv = tokens.some((t) => ENV_TOKEN.test(stripQuotes(t)));
  if (!hasEnv) return null;
  if (ENV_ALLOWED_HEAD.test(head)) return null;
  return { id: "env-secret", reason: ".env（秘密ファイル）の読み書きは禁止。キーは設定画面か人が扱う。" };
}

function splitSegments(command) {
  // 改行・; ・&& ・|| ・| で分割。引用符の中は厳密に見ない（過剰に止める側に倒す）。
  return command.split(/\r?\n|;|&&|\|\||\|/).map((s) => s.trim()).filter(Boolean);
}

function evaluate(command) {
  if (!command || typeof command !== "string") return null;
  for (const segment of splitSegments(command)) {
    for (const rule of RULES) {
      if (rule.re.test(segment)) return { id: rule.id, reason: rule.reason, segment };
    }
    const env = checkEnvSecret(segment);
    if (env) return { ...env, segment };
  }
  // 分割しない全文でも一度見る（複雑な引用の取りこぼし対策）。
  for (const rule of RULES) {
    if (rule.re.test(command)) return { id: rule.id, reason: rule.reason, segment: command };
  }
  return null;
}

// stdin は「JSON が 1 つ揃った時点」で読み終える。
// ホストが EOF を送らないことがある（Windows の Cursor で確認）ので、EOF 待ちにしない。
// 一定時間何も来なければ入力なしとして扱う。
function readStdin(timeoutMs = 3000) {
  return new Promise((resolve) => {
    let raw = "";
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        process.stdin.pause();
      } catch {
        // noop
      }
      fn();
    };
    const tryParse = (final) => {
      const text = raw.trim();
      if (!text) {
        if (final) finish(() => resolve({}));
        return;
      }
      try {
        const parsed = JSON.parse(text);
        finish(() => resolve(parsed));
      } catch (err) {
        // 途中のチャンクは失敗して当然。最終でも壊れているなら「読めない」印を返す。
        // ここで reject して exit 1 すると failClosed が全シェルを凍らせるので、
        // コマンドを判定できないことを allow 側に倒す（危険操作は他層 + サーバ側 protection で担保）。
        if (final) finish(() => resolve({ __unreadable: String((err && err.message) || err) }));
      }
    };
    const timer = setTimeout(() => tryParse(true), timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
      tryParse(false);
    });
    process.stdin.on("end", () => tryParse(true));
    process.stdin.on("error", () => tryParse(true));
    process.stdin.resume();
  });
}

function extractCommand(input) {
  if (typeof input.command === "string") return input.command;
  const ti = input.tool_input;
  if (ti && typeof ti === "object") {
    for (const key of ["command", "cmd", "script", "commandLine"]) {
      if (typeof ti[key] === "string") return ti[key];
    }
  }
  return "";
}

function logBlock(hit, command, cwd) {
  try {
    const base = MODE === "qoder" ? join(homedir(), ".qoder", "hooks") : join(homedir(), ".cursor", "hooks");
    const file = process.env.GUARD_SHELL_LOG || join(base, "blocked.log");
    mkdirSync(dirname(file), { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      mode: MODE,
      rule: hit.id,
      cwd: cwd || process.cwd(),
      command: command.length > 400 ? `${command.slice(0, 400)}...` : command,
    });
    appendFileSync(file, `${line}\n`, "utf8");
  } catch {
    // ログに失敗しても deny 自体は続ける
  }
}

// Windows ではパイプへの process.stdout.write が非同期になり、process.exit で出力が消える。
// hook の出力は必ず同期で書く。
function out(fd, text) {
  try {
    writeSync(fd, text);
  } catch {
    // 出力先が閉じていても exit code で判定できるようにする
  }
}

function debugLog(text) {
  if (!process.env.GUARD_SHELL_DEBUG) return;
  try {
    const file = join(homedir(), ".cursor", "hooks", "guard-debug.log");
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${new Date().toISOString()} ${text}\n`, "utf8");
  } catch {
    // noop
  }
}

async function main() {
  debugLog(`start cwd=${process.cwd()} argv=${JSON.stringify(process.argv.slice(2))} node=${process.version} stdinTTY=${process.stdin.isTTY}`);
  let input = {};
  try {
    input = await readStdin();
    debugLog(`stdin=${JSON.stringify(input).slice(0, 500)}`);
  } catch (err) {
    // ここには来ない想定（readStdin は reject しない）。来ても凍結を避けて allow で通す。
    debugLog(`readStdin threw: ${err && err.message}`);
    input = { __unreadable: true };
  }
  if (input && input.__unreadable) {
    logBlock({ id: "stdin-unreadable", reason: "stdin を読めずコマンドを判定できませんでした（allow で通過）" }, "", "");
    if (MODE === "cursor") out(1, JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }

  const command = extractCommand(input);
  const cwd = input.cwd || (input.tool_input && input.tool_input.cwd) || "";
  const hit = evaluate(command);

  if (!hit) {
    if (MODE === "cursor") out(1, JSON.stringify({ permission: "allow" }));
    process.exit(0);
  }

  logBlock(hit, command, cwd);
  const userMessage = `guard-shell が停止 [${hit.id}]: ${hit.reason}`;
  const agentMessage =
    `このコマンドは hook でブロックされた（rule: ${hit.id}）。${hit.reason} ` +
    `該当部分: ${hit.segment.slice(0, 200)} ` +
    `代替が必要なら、破壊的でない手順に分解して人に確認を求めること。`;

  if (MODE === "cursor") {
    out(1, JSON.stringify({ permission: "deny", user_message: userMessage, agent_message: agentMessage }));
    process.exit(0);
  }

  out(2, `${userMessage}\n${agentMessage}\n`);
  process.exit(2);
}

main().catch((err) => {
  // 想定外の例外でも全シェルを凍らせない。cursor は allow を返し、qoder は exit 0（allow）にする。
  // 危険コマンドの遮断は deny 経路（正常時）と他層（pi 権限・CI・branch protection）で担保する。
  debugLog(`main threw: ${err && err.stack ? err.stack : String(err)}`);
  if (MODE === "cursor") out(1, JSON.stringify({ permission: "allow" }));
  process.exit(0);
});
