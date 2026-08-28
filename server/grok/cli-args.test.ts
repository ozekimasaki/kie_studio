// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildOptimizeGrokArgs,
  clearGrokStatusCacheForTests,
  resolveOptimizeGrokModel,
  setGrokRunnerForTests,
} from './cli.ts'
import {
  parseGrokModelsOutput,
  pickOptimizeGrokModel,
} from './optimize-model.ts'

const GROK_MODELS_FIXTURE = `You are using XAI_API_KEY.

Default model: grok-4.6

Available models:
  * grok-4.6 (default)
  - grok-4.5
`

describe('parseGrokModelsOutput', () => {
  it('parses the official grok models printer format', () => {
    expect(parseGrokModelsOutput(GROK_MODELS_FIXTURE)).toEqual({
      defaultModel: 'grok-4.6',
      ids: ['grok-4.6', 'grok-4.5'],
    })
  })

  it('parses login banner and custom model ids', () => {
    const text = [
      'You are logged in with grok.com.',
      '',
      'Default model: company-grok',
      '',
      'Available models:',
      '  * company-grok (default)',
      '  - grok-4.6',
      '  - grok-4.5',
    ].join('\n')
    expect(parseGrokModelsOutput(text)).toEqual({
      defaultModel: 'company-grok',
      ids: ['company-grok', 'grok-4.6', 'grok-4.5'],
    })
  })

  it('strips ANSI and ignores duplicate ids', () => {
    const text =
      '\u001B[32mDefault model: grok-4.6\u001B[0m\n' +
      '  * grok-4.6 (default)\n' +
      '  - grok-4.6\n' +
      '  - grok-4.5\n'
    expect(parseGrokModelsOutput(text)).toEqual({
      defaultModel: 'grok-4.6',
      ids: ['grok-4.6', 'grok-4.5'],
    })
  })

  it('returns empty catalog for unrelated output', () => {
    expect(parseGrokModelsOutput('grok 1.2.3')).toEqual({
      defaultModel: undefined,
      ids: [],
    })
  })
})

describe('pickOptimizeGrokModel', () => {
  const catalog = {
    defaultModel: 'grok-4.6',
    ids: ['grok-4.6', 'grok-4.5'],
  }

  it('uses the CLI default from the live list', () => {
    expect(pickOptimizeGrokModel(catalog)).toBe('grok-4.6')
  })

  it('ignores a stale default that is not in the live list', () => {
    expect(
      pickOptimizeGrokModel({
        defaultModel: 'grok-build',
        ids: ['grok-4.6', 'grok-4.5'],
      }),
    ).toBe('grok-4.6')
  })

  it('uses STUDIO override when it is in the list', () => {
    expect(pickOptimizeGrokModel(catalog, 'grok-4.5')).toBe('grok-4.5')
  })

  it('treats blank override as unset', () => {
    expect(pickOptimizeGrokModel(catalog, '  ')).toBe('grok-4.6')
    expect(pickOptimizeGrokModel(catalog, '')).toBe('grok-4.6')
  })

  it('rejects an override that is not in the live list', () => {
    expect(() => pickOptimizeGrokModel(catalog, 'grok-build')).toThrow(
      /grok-build/,
    )
    expect(() => pickOptimizeGrokModel(catalog, 'grok-build')).toThrow(
      /grok-4\.6, grok-4\.5/,
    )
  })

  it('allows an override when the list could not be parsed', () => {
    expect(
      pickOptimizeGrokModel({ ids: [] }, 'custom-model'),
    ).toBe('custom-model')
  })

  it('uses the first listed id when the default is missing', () => {
    expect(pickOptimizeGrokModel({ ids: ['grok-4.5', 'grok-4.6'] })).toBe(
      'grok-4.5',
    )
  })

  it('throws when the catalog is empty', () => {
    expect(() => pickOptimizeGrokModel({ ids: [] })).toThrow(/空/)
  })
})

describe('buildOptimizeGrokArgs', () => {
  const workDir = '/tmp/kie-optimize-test'
  const prompt = 'Read @optimize-request.md. Follow the request file exactly.'

  it('passes -m with the resolved live model id', () => {
    expect(buildOptimizeGrokArgs(workDir, prompt, 'grok-4.6')).toEqual([
      '--no-auto-update',
      '--cwd',
      workDir,
      '-m',
      'grok-4.6',
      '-p',
      prompt,
      '--output-format',
      'plain',
    ])
  })
})

describe('resolveOptimizeGrokModel', () => {
  afterEach(() => {
    setGrokRunnerForTests(null)
  })

  it('picks the live default from grok models, not a hardcoded alias', async () => {
    const calls: string[][] = []
    setGrokRunnerForTests(async (args) => {
      calls.push(args)
      if (args[0] === '--version') {
        return { stdout: 'grok 1.0.0', stderr: '', code: 0 }
      }
      return { stdout: GROK_MODELS_FIXTURE, stderr: '', code: 0 }
    })

    await expect(resolveOptimizeGrokModel({})).resolves.toBe('grok-4.6')
    expect(calls.some((args) => args.includes('models'))).toBe(true)
  })

  it('refetches grok models when the CLI version changes', async () => {
    let version = '1.0.0'
    let modelsOutput = GROK_MODELS_FIXTURE
    let modelsCalls = 0
    setGrokRunnerForTests(async (args) => {
      if (args[0] === '--version') {
        return { stdout: `grok ${version}`, stderr: '', code: 0 }
      }
      modelsCalls += 1
      return { stdout: modelsOutput, stderr: '', code: 0 }
    })

    await expect(resolveOptimizeGrokModel({})).resolves.toBe('grok-4.6')
    await expect(resolveOptimizeGrokModel({})).resolves.toBe('grok-4.6')
    expect(modelsCalls).toBe(1)

    version = '1.1.0'
    modelsOutput = `Default model: grok-4.7

Available models:
  * grok-4.7 (default)
  - grok-4.6
`
    clearGrokStatusCacheForTests()
    await expect(resolveOptimizeGrokModel({})).resolves.toBe('grok-4.7')
    expect(modelsCalls).toBe(2)
  })

  it('rejects STUDIO_GROK_OPTIMIZE_MODEL when it is absent from grok models', async () => {
    setGrokRunnerForTests(async (args) => {
      if (args[0] === '--version') {
        return { stdout: 'grok 1.0.0', stderr: '', code: 0 }
      }
      return { stdout: GROK_MODELS_FIXTURE, stderr: '', code: 0 }
    })

    await expect(
      resolveOptimizeGrokModel({ STUDIO_GROK_OPTIMIZE_MODEL: 'grok-build' }),
    ).rejects.toThrow(/grok-build/)
  })
})
