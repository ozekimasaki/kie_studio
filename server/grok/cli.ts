import { spawn } from 'node:child_process'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  formatProfileRulesMarkdown,
  getOptimizeProfile,
  guideAbsolutePath,
  type OptimizeProfile,
} from './optimize-profiles.ts'

const STATUS_CACHE_MS = 60_000
const OPTIMIZE_TIMEOUT_MS = 120_000

const OPT_START = '<<<OPTIMIZED>>>'
const OPT_END = '<<<END>>>'

export class GrokCliError extends Error {
  readonly code?: 'unavailable' | 'timeout' | 'failed' | 'empty'

  constructor(
    message: string,
    code?: 'unavailable' | 'timeout' | 'failed' | 'empty',
  ) {
    super(message)
    this.name = 'GrokCliError'
    this.code = code
  }
}

type StatusCache = {
  at: number
  available: boolean
  version?: string
}

let statusCache: StatusCache | null = null

function killProcessTree(child: ReturnType<typeof spawn>) {
  if (child.pid == null) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    })
    return
  }
  child.kill('SIGKILL')
}

function runGrok(
  args: string[],
  options?: { timeoutMs?: number; cwd?: string },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const timeoutMs = options?.timeoutMs ?? 15_000

  return new Promise((resolvePromise, reject) => {
    const child = spawn('grok', args, {
      shell: false,
      windowsHide: true,
      cwd: options?.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      killProcessTree(child)
      reject(new GrokCliError('Grok Build の応答がタイムアウトしました', 'timeout'))
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const notFound =
        'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
      reject(
        new GrokCliError(
          notFound
            ? 'Grok Build がインストールされていません'
            : `Grok Build を起動できません: ${err.message}`,
          'unavailable',
        ),
      )
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise({ stdout, stderr, code })
    })
  })
}

export async function getGrokStatus(options?: {
  force?: boolean
}): Promise<{ available: boolean; version?: string }> {
  const now = Date.now()
  if (
    !options?.force &&
    statusCache &&
    now - statusCache.at < STATUS_CACHE_MS
  ) {
    return {
      available: statusCache.available,
      version: statusCache.version,
    }
  }

  try {
    const { stdout, stderr, code } = await runGrok(['--version'], {
      timeoutMs: 10_000,
    })
    const text = `${stdout}\n${stderr}`.trim()
    const available = code === 0 || /grok/i.test(text)
    const versionMatch = text.match(/(\d+\.\d+(?:\.\d+)?[^\s]*)/)
    const version = versionMatch?.[1]
    statusCache = { at: now, available, version }
    return { available, version }
  } catch {
    statusCache = { at: now, available: false }
    return { available: false }
  }
}

function buildOptimizeRequest(params: {
  prompt: string
  customInstructions?: string
  modelId?: string
  profile: OptimizeProfile
  guideFileName?: string
}): string {
  const custom = params.customInstructions?.trim()
  const modelLine = params.modelId
    ? `対象モデル ID: ${params.modelId}`
    : '対象モデル: （未指定）'

  const guideInstruction = params.guideFileName
    ? `同じ作業ディレクトリの ${params.guideFileName} を読み、そのガイドを最優先で従う。下記プロファイルは補足とする。`
    : '下記の最適化プロファイルに従って下書きプロンプトを改善する。'

  const role =
    params.profile.modality === 'video'
      ? 'あなたは動画生成向けプロンプト最適化アシスタントです。'
      : 'あなたは画像生成向けプロンプト最適化アシスタントです。'

  return [
    role,
    guideInstruction,
    '',
    modelLine,
    '',
    formatProfileRulesMarkdown(params.profile),
    '',
    custom
      ? ['## ユーザーのカスタム指示（最優先で反映）', custom, ''].join('\n')
      : '',
    '## 最適化対象のプロンプト',
    params.prompt,
    '',
    '## 出力ルール',
    '- 最適化後のプロンプト本文のみを出力する。',
    '- 説明・前置き・箇条書きの解説は禁止。',
    '- 入力にあった参照タグ（@image / [Image N] / @element 等）は形式と番号を維持する。',
    `- 必ず次のマーカーで囲む: ${OPT_START} と ${OPT_END}`,
    '- マーカーの外側には何も書かない。',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

function extractOptimized(raw: string): string {
  const start = raw.indexOf(OPT_START)
  const end = raw.indexOf(OPT_END)
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start + OPT_START.length, end).trim()
  }
  const fenced = raw.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  if (fenced?.[1]) return fenced[1].trim()
  return raw.trim()
}

export async function optimizePromptWithGrok(params: {
  prompt: string
  customInstructions?: string
  modelId?: string
}): Promise<{ optimizedPrompt: string; profile: OptimizeProfile }> {
  const status = await getGrokStatus()
  if (!status.available) {
    throw new GrokCliError(
      'Grok Build がインストールされていません',
      'unavailable',
    )
  }

  const profile = getOptimizeProfile(params.modelId)
  const workDir = await mkdtemp(join(tmpdir(), 'kie-optimize-'))
  const requestPath = join(workDir, 'optimize-request.md')
  const guideSrc = guideAbsolutePath(profile)
  let guideFileName: string | undefined

  try {
    if (guideSrc) {
      guideFileName = basename(guideSrc)
      const guideDest = join(workDir, guideFileName)
      try {
        await copyFile(guideSrc, guideDest)
      } catch {
        const guide = await readFile(guideSrc, 'utf8')
        await writeFile(guideDest, guide, 'utf8')
      }
    }

    await writeFile(
      requestPath,
      buildOptimizeRequest({
        prompt: params.prompt,
        customInstructions: params.customInstructions,
        modelId: params.modelId,
        profile,
        guideFileName,
      }),
      'utf8',
    )

    const fileMentions = guideFileName
      ? `@optimize-request.md and @${guideFileName}`
      : '@optimize-request.md'

    const headlessPrompt = [
      `Read ${fileMentions}.`,
      'Follow the request file exactly.',
      `Reply with only the optimized prompt wrapped in ${OPT_START} and ${OPT_END}.`,
      'Do not use tools other than reading those files. Do not explain.',
    ].join(' ')

    const result = await runGrok(
      [
        '--no-auto-update',
        '--cwd',
        workDir,
        '-p',
        headlessPrompt,
        '--output-format',
        'plain',
      ],
      { timeoutMs: OPTIMIZE_TIMEOUT_MS, cwd: workDir },
    )

    if (result.code !== 0 && !result.stdout.trim()) {
      const detail = result.stderr.trim() || `exit code ${result.code}`
      throw new GrokCliError(
        `Grok Build の実行に失敗しました: ${detail}`,
        'failed',
      )
    }

    const optimized = extractOptimized(result.stdout || result.stderr)
    if (!optimized) {
      throw new GrokCliError('最適化結果が空でした', 'empty')
    }
    return { optimizedPrompt: optimized, profile }
  } catch (e) {
    if (e instanceof GrokCliError) throw e
    throw new GrokCliError(
      e instanceof Error ? e.message : 'Grok Build の実行に失敗しました',
      'failed',
    )
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}
