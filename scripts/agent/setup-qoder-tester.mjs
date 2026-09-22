#!/usr/bin/env node
// setup-qoder-tester.mjs — qoder-acceptance.yml が使う Qoder Cloud Agents の Tester を一括セットアップする。
//
//   1. Environment を取得（無ければ作成）
//   2. Agent `kie-acceptance-tester` を取得（無ければ作成）
//   3. GitHub リポジトリに secret QODER_ACCESS_TOKEN と vars QODER_AGENT_ID / QODER_ENVIRONMENT_ID を登録
//
// 使い方（PowerShell）:
//   $env:QODER_ACCESS_TOKEN = "pt-..."     # Qoder コンソール → Settings → Personal Access Tokens
//   node scripts/agent/setup-qoder-tester.mjs [--dry-run] [--no-gh]
// 環境変数:
//   QODER_ACCESS_TOKEN  必須。PAT（pt- で始まる）。標準出力には一切出さない
//   QODER_API_BASE_URL  既定 https://api.qoder.com
//   QODER_MODEL         既定 ultimate
//   QODER_ENV_NAME      既定 kie-studio（既存が無いときに作る Environment 名）
//   KIE_AGENT_REPO      既定 ozekimasaki/kie_studio

import { spawnSync } from "node:child_process";

const TOKEN = process.env.QODER_ACCESS_TOKEN;
const BASE = (process.env.QODER_API_BASE_URL || "https://api.qoder.com").replace(/\/$/, "");
const MODEL = process.env.QODER_MODEL || "ultimate";
const ENV_NAME = process.env.QODER_ENV_NAME || "kie-studio";
const REPO = process.env.KIE_AGENT_REPO || "ozekimasaki/kie_studio";
const AGENT_NAME = "kie-acceptance-tester";
const DRY_RUN = process.argv.includes("--dry-run");
const NO_GH = process.argv.includes("--no-gh");

const SYSTEM_PROMPT = [
  `あなたは GitHub リポジトリ ${REPO} の Pull Request を検証する「独立した受け入れテスト役（Tester）」です。`,
  "リポジトリは /data/workspace/kie_studio にマウントされ、gh は GH_TOKEN で認証済みです。git と gh はこのディレクトリの中で実行します。",
  "",
  "原則:",
  "- コードの変更・commit・push・approve・merge・ラベル操作（acceptance-failed の付与を除く）は行わない",
  "- 検証は必ず実行結果に基づく。実行していないものを「成功」と書かない",
  "- 判定は PASS / FAIL の二値。PASS の条件は「lint / test / tsc がすべて成功」「PR に紐づく受け入れ条件をすべて満たす」「テストの削除や skip で通していない」の 3 点が揃うこと",
  "- 結果は PR コメント 1 件に集約する。1 行目は必ず「## qoder-acceptance: PASS」または「## qoder-acceptance: FAIL」",
  "- FAIL のときは再現手順・期待値・実際値を書き、bug Issue（ラベル bug, autonomous）を作って実装役に差し戻す",
  "- 秘密情報（トークン・キー）をコメントやログに書かない",
].join("\n");

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

async function ensureEnvironment() {
  const list = await api("GET", "/api/v1/cloud/environments");
  const envs = Array.isArray(list.data) ? list.data.filter((e) => !e.archived_at) : [];
  const byName = envs.find((e) => e.name === ENV_NAME) || envs.find((e) => e.name === "default") || envs[0];
  if (byName) {
    console.log(`environment: ${byName.id} (${byName.name}) [existing]`);
    return byName.id;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] would create environment "${ENV_NAME}"`);
    return "env_dry_run";
  }
  const created = await api("POST", "/api/v1/cloud/environments", { name: ENV_NAME });
  console.log(`environment: ${created.id} (${created.name}) [created]`);
  return created.id;
}

async function ensureAgent() {
  const list = await api("GET", "/api/v1/cloud/agents");
  const agents = Array.isArray(list.data) ? list.data.filter((a) => !a.archived_at) : [];
  const existing = agents.find((a) => a.name === AGENT_NAME);
  if (existing) {
    console.log(`agent: ${existing.id} (${existing.name}, v${existing.version}) [existing]`);
    return existing.id;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] would create agent "${AGENT_NAME}" with model ${MODEL}`);
    return "agent_dry_run";
  }
  const created = await api("POST", "/api/v1/cloud/agents", {
    name: AGENT_NAME,
    description: `${REPO} の PR を独立に受け入れテストする Tester。qoder-acceptance.yml から起動される。`,
    model: MODEL,
    system: SYSTEM_PROMPT,
    tools: [{ type: "agent_toolset_20260401", enabled_tools: ["Bash", "Read", "Glob", "Grep", "Write", "Edit"] }],
    metadata: { purpose: "acceptance", repo: REPO },
  });
  console.log(`agent: ${created.id} (${created.name}) [created]`);
  return created.id;
}

function gh(args, input) {
  const r = spawnSync("gh", args, { encoding: "utf8", input, windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`gh ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  return r.stdout.trim();
}

async function main() {
  if (!TOKEN) fail("QODER_ACCESS_TOKEN が未設定です。Qoder コンソール → Settings → Personal Access Tokens で作成し、環境変数に入れてから実行してください。");
  if (!TOKEN.startsWith("pt-")) console.warn("warn: PAT は通常 pt- で始まります。Service Account Token の場合は 12 時間で失効するので GitHub secret には PAT を使ってください。");

  const envId = await ensureEnvironment();
  const agentId = await ensureAgent();

  if (NO_GH || DRY_RUN) {
    console.log("\n手動で登録する場合:");
    console.log(`  gh secret set QODER_ACCESS_TOKEN --repo ${REPO}     # 値はプロンプトで入力`);
    console.log(`  gh variable set QODER_AGENT_ID --repo ${REPO} --body ${agentId}`);
    console.log(`  gh variable set QODER_ENVIRONMENT_ID --repo ${REPO} --body ${envId}`);
    return;
  }

  gh(["secret", "set", "QODER_ACCESS_TOKEN", "--repo", REPO], TOKEN);
  gh(["variable", "set", "QODER_AGENT_ID", "--repo", REPO, "--body", agentId]);
  gh(["variable", "set", "QODER_ENVIRONMENT_ID", "--repo", REPO, "--body", envId]);
  console.log(`\nGitHub に登録しました: secret QODER_ACCESS_TOKEN, vars QODER_AGENT_ID=${agentId}, QODER_ENVIRONMENT_ID=${envId}`);
  console.log("確認: gh variable list --repo " + REPO);
  console.log("動作確認: needs-review ラベルの PR で `gh workflow run qoder-acceptance.yml -f pr=<番号>`");
}

main().catch((err) => fail(err.message));
