// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  GROK_OPTIMIZE_MODEL_ALIAS,
  buildOptimizeGrokArgs,
  resolveOptimizeGrokModel,
} from './cli.ts'

describe('resolveOptimizeGrokModel', () => {
  it('defaults to the Grok Build rolling alias', () => {
    expect(resolveOptimizeGrokModel({})).toBe(GROK_OPTIMIZE_MODEL_ALIAS)
    expect(resolveOptimizeGrokModel({})).toBe('grok-build')
  })

  it('uses STUDIO_GROK_OPTIMIZE_MODEL when set', () => {
    expect(
      resolveOptimizeGrokModel({ STUDIO_GROK_OPTIMIZE_MODEL: 'grok-4.6' }),
    ).toBe('grok-4.6')
  })

  it('treats blank override as unset', () => {
    expect(resolveOptimizeGrokModel({ STUDIO_GROK_OPTIMIZE_MODEL: '  ' })).toBe(
      GROK_OPTIMIZE_MODEL_ALIAS,
    )
    expect(resolveOptimizeGrokModel({ STUDIO_GROK_OPTIMIZE_MODEL: '' })).toBe(
      GROK_OPTIMIZE_MODEL_ALIAS,
    )
  })
})

describe('buildOptimizeGrokArgs', () => {
  const workDir = '/tmp/kie-optimize-test'
  const prompt = 'Read @optimize-request.md. Follow the request file exactly.'

  it('passes -m grok-build with existing headless flags', () => {
    expect(buildOptimizeGrokArgs(workDir, prompt, {})).toEqual([
      '--no-auto-update',
      '--cwd',
      workDir,
      '-m',
      'grok-build',
      '-p',
      prompt,
      '--output-format',
      'plain',
    ])
  })

  it('honors STUDIO_GROK_OPTIMIZE_MODEL on -m', () => {
    const args = buildOptimizeGrokArgs(workDir, prompt, {
      STUDIO_GROK_OPTIMIZE_MODEL: 'custom-model',
    })
    const modelFlag = args.indexOf('-m')
    expect(modelFlag).toBeGreaterThan(-1)
    expect(args[modelFlag + 1]).toBe('custom-model')
  })
})
