import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  CliError,
  discoverApiBase,
  StudioClient,
  type CatalogModel,
  type FetchImpl,
  type GenerateResult,
  type HistoryRow,
  type TaskStatus,
} from './client.ts'
import {
  GENERATE_HELP,
  HISTORY_HELP,
  MODELS_HELP,
  OPEN_HELP,
  ROOT_HELP,
  STATUS_HELP,
  UP_HELP,
} from './help.ts'
import pkg from '../package.json' with { type: 'json' }

const TERMINAL_STATES = new Set(['success', 'fail', 'partial', 'expired'])
const POLL_MS = 2500
const WAIT_TIMEOUT_MS = 60 * 60 * 1000
const WEB_UI = 'http://localhost:5173'

export interface CliIo {
  stdout: (text: string) => void
  stderr: (text: string) => void
  fetch: FetchImpl
  env: NodeJS.ProcessEnv
  spawnServer: (cwd: string) => Promise<number>
  openUrl: (url: string) => Promise<boolean>
  sleep: (ms: number) => Promise<void>
  now: () => number
  repoRoot: string
}

function defaultRepoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..')
}

function defaultSpawnServer(cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['server/index.ts'], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', (error) => {
      reject(
        new CliError(
          `bun を起動できませんでした: ${error.message}`,
          1,
          '  bun を PATH に入れたうえで kiestudio up を再実行してください',
        ),
      )
    })
    child.on('exit', (code) => {
      resolve(code ?? 1)
    })
  })
}

function openCommand(url: string): string[] {
  switch (process.platform) {
    case 'darwin':
      return ['open', url]
    case 'win32':
      return ['cmd', '/c', 'start', '', url]
    default:
      return ['xdg-open', url]
  }
}

async function defaultOpenUrl(url: string): Promise<boolean> {
  const command = openCommand(url)
  const bin = command[0]
  if (!bin) return false
  const args = command.slice(1)
  return await new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: 'ignore', detached: true })
    child.on('error', () => resolve(false))
    child.on('exit', (code) => resolve(code === 0))
    child.unref()
  })
}

export function createDefaultIo(): CliIo {
  return {
    stdout: (text) => {
      process.stdout.write(`${text}\n`)
    },
    stderr: (text) => {
      process.stderr.write(`${text}\n`)
    },
    fetch,
    env: process.env,
    spawnServer: defaultSpawnServer,
    openUrl: defaultOpenUrl,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
    repoRoot: defaultRepoRoot(),
  }
}

function wantsHelp(args: string[]): boolean {
  return args.includes('-h') || args.includes('--help')
}

function wantsJson(args: string[]): boolean {
  return args.includes('--json')
}

function printError(io: CliIo, error: unknown): void {
  if (error instanceof CliError) {
    io.stderr(`Error: ${error.message}`)
    if (error.hint) io.stderr(error.hint)
    return
  }
  io.stderr(`Error: ${error instanceof Error ? error.message : String(error)}`)
}

async function requireClient(io: CliIo): Promise<StudioClient> {
  const base = await discoverApiBase({
    envBase: io.env.STUDIO_API_BASE,
    fetchImpl: io.fetch,
  })
  if (!base) {
    throw new CliError(
      'Studio API が起動していません',
      1,
      '  kiestudio up\n  npm run dev',
    )
  }
  return new StudioClient(base, io.fetch)
}

function emit(io: CliIo, jsonMode: boolean, value: unknown, text: string): void {
  if (jsonMode) {
    io.stdout(JSON.stringify(value, null, 2))
    return
  }
  io.stdout(text)
}

function parseFlagArgs(
  args: string[],
  options: Parameters<typeof parseArgs>[0]['options'],
) {
  try {
    return parseArgs({
      args,
      options,
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    throw new CliError(
      error instanceof Error ? error.message : '引数を解析できませんでした',
      1,
    )
  }
}

async function cmdUp(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(UP_HELP.trimEnd())
    return 0
  }
  const existing = await discoverApiBase({
    envBase: io.env.STUDIO_API_BASE,
    fetchImpl: io.fetch,
  })
  if (existing) {
    emit(
      io,
      wantsJson(args),
      { running: true, base: existing },
      `API は既に起動しています: ${existing}`,
    )
    return 0
  }
  io.stderr('Studio API を起動します (bun server/index.ts)')
  return io.spawnServer(io.repoRoot)
}

async function webUiReachable(io: CliIo): Promise<boolean> {
  try {
    const res = await io.fetch(WEB_UI, { signal: AbortSignal.timeout(400) })
    return res.ok || res.status === 304
  } catch {
    return false
  }
}

async function cmdOpen(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(OPEN_HELP.trimEnd())
    return 0
  }
  const reachable = await webUiReachable(io)
  if (!reachable) {
    io.stderr(`Web UI に接続できません (${WEB_UI})`)
    io.stderr('  npm run dev')
    return 1
  }
  const opened = await io.openUrl(WEB_UI)
  if (!opened) {
    io.stderr(`ブラウザを開けませんでした。手動で開いてください: ${WEB_UI}`)
    return 1
  }
  emit(io, wantsJson(args), { url: WEB_UI }, WEB_UI)
  return 0
}

function filterModels(models: CatalogModel[], query?: string): CatalogModel[] {
  if (!query) return models
  const q = query.toLowerCase()
  return models.filter((model) =>
    `${model.id} ${model.model} ${model.title}`.toLowerCase().includes(q),
  )
}

function formatModels(models: CatalogModel[]): string {
  if (models.length === 0) return '(no models)'
  return models
    .map(
      (model) =>
        `${model.id}\t${model.category}\t${model.provider}\t${model.title}`,
    )
    .join('\n')
}

async function cmdModels(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(MODELS_HELP.trimEnd())
    return 0
  }
  const parsed = parseFlagArgs(args, {
    category: { type: 'string' },
    json: { type: 'boolean' },
  })
  const category = parsed.values.category
  if (
    category !== undefined &&
    category !== 'image' &&
    category !== 'video' &&
    category !== 'audio'
  ) {
    throw new CliError(
      'category は image / video / audio のいずれかです',
      1,
      '  kiestudio models --category image',
    )
  }
  const client = await requireClient(io)
  const data = await client.listModels(category)
  const items = filterModels(data.models, parsed.positionals[0])
  emit(io, Boolean(parsed.values.json), { models: items }, formatModels(items))
  return 0
}

export function resolveCatalogModel(
  models: CatalogModel[],
  query: string,
): CatalogModel {
  const byId = models.find((model) => model.id === query)
  if (byId) return byId
  const byModel = models.filter((model) => model.model === query)
  if (byModel.length === 1) return byModel[0]
  if (byModel.length > 1) {
    const generated =
      byModel.find((model) => (model.operation ?? 'generate') === 'generate') ??
      byModel[0]
    return generated
  }
  const lower = query.toLowerCase()
  const byTitle = models.filter((model) => model.title.toLowerCase() === lower)
  if (byTitle.length === 1) return byTitle[0]
  const partial = models.filter((model) =>
    `${model.id} ${model.model} ${model.title}`.toLowerCase().includes(lower),
  )
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    const preview = partial
      .slice(0, 10)
      .map((model) => `  ${model.id}  ${model.title}`)
      .join('\n')
    throw new CliError(
      `モデルが複数ヒットしました: ${query}`,
      1,
      `候補:\n${preview}\n  kiestudio models ${query}`,
    )
  }
  throw new CliError(
    `モデルが見つかりません: ${query}`,
    1,
    `  kiestudio models ${query}`,
  )
}

export function parseSetPair(raw: string): [string, unknown] {
  const eq = raw.indexOf('=')
  if (eq <= 0) {
    throw new CliError(
      `--set は key=value 形式です: ${raw}`,
      1,
      '  kiestudio generate -m <id> --set aspect_ratio=16:9',
    )
  }
  const key = raw.slice(0, eq)
  const value = raw.slice(eq + 1)
  try {
    return [key, JSON.parse(value) as unknown]
  } catch {
    return [key, value]
  }
}

function buildInput(options: {
  prompt?: string
  inputJson?: string
  sets: string[]
}): Record<string, unknown> {
  let input: Record<string, unknown> = {}
  if (options.inputJson) {
    let parsed: unknown
    try {
      parsed = JSON.parse(options.inputJson)
    } catch {
      throw new CliError(
        '--input は JSON オブジェクトである必要があります',
        1,
        `  kiestudio generate -m <id> --input '{"prompt":"hi"}'`,
      )
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CliError(
        '--input は JSON オブジェクトである必要があります',
        1,
        `  kiestudio generate -m <id> --input '{"prompt":"hi"}'`,
      )
    }
    input = { ...(parsed as Record<string, unknown>) }
  }
  for (const raw of options.sets) {
    const [key, value] = parseSetPair(raw)
    input[key] = value
  }
  if (options.prompt !== undefined) input.prompt = options.prompt
  return input
}

function missingRequired(
  model: CatalogModel,
  input: Record<string, unknown>,
): string[] {
  return (model.fields ?? [])
    .filter((field) => field.required)
    .map((field) => field.name)
    .filter((name) => {
      const value = input[name]
      return value === undefined || value === null || value === ''
    })
}

function formatGenerate(result: GenerateResult, model: CatalogModel): string {
  const lines = [
    `taskId: ${result.taskId}`,
    `model: ${model.id}`,
    `state: ${result.task?.state ?? 'waiting'}`,
  ]
  if (result.task?.failMsg) lines.push(`failMsg: ${result.task.failMsg}`)
  return lines.join('\n')
}

async function waitForTask(
  client: StudioClient,
  params: { taskId: string; provider: string; operation: string },
  io: CliIo,
): Promise<TaskStatus> {
  const deadline = io.now() + WAIT_TIMEOUT_MS
  let last: TaskStatus | undefined
  while (io.now() < deadline) {
    last = await client.getTask(params)
    if (TERMINAL_STATES.has(last.state)) return last
    await io.sleep(POLL_MS)
  }
  throw new CliError(
    `タスクが時間内に終わりませんでした: ${params.taskId}`,
    1,
    `  kiestudio status ${params.taskId} --wait`,
  )
}

function formatStatus(task: TaskStatus): string {
  const lines = [`taskId: ${task.taskId}`, `state: ${task.state}`]
  if (task.failMsg) lines.push(`failMsg: ${task.failMsg}`)
  const urls = task.resultUrls?.length
    ? task.resultUrls
    : task.media.map((asset) => asset.url ?? asset.streamUrl).filter(Boolean)
  if (urls.length) lines.push(`urls: ${urls.join(' ')}`)
  return lines.join('\n')
}

async function cmdGenerate(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(GENERATE_HELP.trimEnd())
    return 0
  }
  const parsed = parseFlagArgs(args, {
    model: { type: 'string', short: 'm' },
    prompt: { type: 'string', short: 'p' },
    input: { type: 'string' },
    set: { type: 'string', multiple: true },
    wait: { type: 'boolean' },
    json: { type: 'boolean' },
  })
  const modelQuery = parsed.values.model
  if (!modelQuery) {
    throw new CliError(
      'モデル (-m) が必要です',
      1,
      '  kiestudio generate -m flux-kontext-pro -p "a red bicycle"',
    )
  }
  const client = await requireClient(io)
  const catalog = await client.listModels()
  const model = resolveCatalogModel(catalog.models, modelQuery)
  const input = buildInput({
    prompt: parsed.values.prompt,
    inputJson: parsed.values.input,
    sets: parsed.values.set ?? [],
  })
  const missing = missingRequired(model, input)
  if (missing.length > 0) {
    throw new CliError(
      `必須フィールドが不足しています: ${missing.join(', ')}`,
      1,
      `  kiestudio generate -m ${model.id} --input '{"${missing[0]}":"..."}'`,
    )
  }
  const created = await client.generate({
    model: model.model,
    provider: model.provider,
    operation: model.operation ?? 'generate',
    input,
    workflowId: model.id,
  })
  let payload: GenerateResult | TaskStatus = created
  if (parsed.values.wait) {
    payload = await waitForTask(
      client,
      {
        taskId: created.taskId,
        provider: model.provider,
        operation: model.operation ?? 'generate',
      },
      io,
    )
  }
  const text =
    'state' in payload && payload.state
      ? formatStatus(payload)
      : formatGenerate(created, model)
  emit(
    io,
    Boolean(parsed.values.json),
    { ...payload, workflowId: model.id, provider: model.provider },
    text,
  )
  return 0
}

async function cmdStatus(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(STATUS_HELP.trimEnd())
    return 0
  }
  const parsed = parseFlagArgs(args, {
    provider: { type: 'string' },
    operation: { type: 'string' },
    wait: { type: 'boolean' },
    json: { type: 'boolean' },
  })
  const taskId = parsed.positionals[0]
  if (!taskId) {
    throw new CliError(
      'taskId が必要です',
      1,
      '  kiestudio status <taskId> --wait',
    )
  }
  const provider = parsed.values.provider ?? 'market'
  const operation = parsed.values.operation ?? 'generate'
  const client = await requireClient(io)
  const task = parsed.values.wait
    ? await waitForTask(client, { taskId, provider, operation }, io)
    : await client.getTask({ taskId, provider, operation })
  emit(io, Boolean(parsed.values.json), task, formatStatus(task))
  return 0
}

function formatHistory(items: HistoryRow[]): string {
  if (items.length === 0) return '(no history)'
  return items
    .map((item) => {
      const prompt = item.prompt ? item.prompt.replaceAll('\n', ' ').slice(0, 80) : ''
      return `${item.taskId}\t${item.state}\t${item.category}\t${item.model}\t${prompt}`
    })
    .join('\n')
}

async function cmdHistory(args: string[], io: CliIo): Promise<number> {
  if (wantsHelp(args)) {
    io.stdout(HISTORY_HELP.trimEnd())
    return 0
  }
  const parsed = parseFlagArgs(args, {
    category: { type: 'string' },
    json: { type: 'boolean' },
  })
  const category = parsed.values.category
  if (
    category !== undefined &&
    category !== 'image' &&
    category !== 'video' &&
    category !== 'audio'
  ) {
    throw new CliError(
      'category は image / video / audio のいずれかです',
      1,
      '  kiestudio history --category image',
    )
  }
  const client = await requireClient(io)
  const data = await client.listHistory()
  const query = parsed.positionals[0]?.toLowerCase()
  let items = data.items
  if (category) items = items.filter((item) => item.category === category)
  if (query) {
    items = items.filter((item) =>
      `${item.taskId} ${item.model} ${item.prompt ?? ''}`.toLowerCase().includes(query),
    )
  }
  emit(io, Boolean(parsed.values.json), { items, count: items.length }, formatHistory(items))
  return 0
}

export async function main(
  argv: string[],
  io: CliIo = createDefaultIo(),
): Promise<number> {
  try {
    const [command, ...rest] = argv
    if (!command || command === '-h' || command === '--help' || command === 'help') {
      io.stdout(ROOT_HELP.trimEnd())
      return 0
    }
    if (command === '-V' || command === '--version' || command === 'version') {
      io.stdout(pkg.version)
      return 0
    }
    switch (command) {
      case 'up':
        return await cmdUp(rest, io)
      case 'open':
        return await cmdOpen(rest, io)
      case 'models':
        return await cmdModels(rest, io)
      case 'generate':
        return await cmdGenerate(rest, io)
      case 'status':
        return await cmdStatus(rest, io)
      case 'history':
        return await cmdHistory(rest, io)
      default:
        throw new CliError(
          `不明なコマンドです: ${command}`,
          1,
          '  kiestudio --help',
        )
    }
  } catch (error) {
    printError(io, error)
    return error instanceof CliError ? error.exitCode : 1
  }
}
