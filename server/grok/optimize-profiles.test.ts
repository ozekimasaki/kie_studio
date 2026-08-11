// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatProfileRulesMarkdown,
  getOptimizeProfile,
  resolveOptimizeFamily,
} from './optimize-profiles.ts'

describe('resolveOptimizeFamily', () => {
  it.each([
    ['bytedance/seedance-2-5', 'seedance-2-5'],
    ['bytedance/seedance-2.5', 'seedance-2-5'],
    ['bytedance/seedance-1-5-pro', 'seedance'],
    ['kling/v2-1-master', 'kling'],
    ['wan/v2-2-a14b', 'wan'],
    ['minimax/hailuo-02', 'hailuo'],
    ['happyhorse/video-1', 'happyhorse'],
    ['grok-imagine/fast', 'grok-imagine'],
    ['bytedance/seedream-v4', 'seedream'],
    ['flux/kontext-pro', 'flux'],
    ['ideogram/v3', 'ideogram'],
    ['google/imagen-4', 'imagen'],
    ['google/nano-banana-edit', 'nano-banana'],
    ['openai/gpt-image-1', 'gpt-image'],
    ['qwen/image-edit', 'qwen'],
  ])('maps %s to %s', (modelId, family) => {
    expect(resolveOptimizeFamily(modelId)).toBe(family)
  })

  it('falls back by modality for unknown models', () => {
    expect(resolveOptimizeFamily(undefined)).toBe('generic-video')
    expect(resolveOptimizeFamily('someone/video-model-x')).toBe('generic-video')
    expect(resolveOptimizeFamily('someone/photo-model-x')).toBe('generic-image')
  })
})

describe('getOptimizeProfile guide embedding', () => {
  it('uses the official Seedance 2.5 guide only for 2.5 models', () => {
    const profile = getOptimizeProfile('bytedance/seedance-2-5')
    expect(profile.family).toBe('seedance-2-5')
    expect(profile.guide?.fileName).toContain('2.5')
    expect(profile.guide?.content).toContain('合計最大50素材')
    expect(profile.guide?.content).toContain('整数秒のタイムスタンプ')
    expect(profile.guide?.content).toContain('動画編集')
    expect(profile.guide?.content).toContain('素材バイナリが渡らず')
    expect(profile.guide?.content).toContain('総尺だけを指定した場合')
  })

  it('embeds the Seedance guide content (no filesystem access needed)', () => {
    const profile = getOptimizeProfile('bytedance/seedance-1-5-pro')
    expect(profile.guide).toBeDefined()
    expect(profile.guide?.fileName).toMatch(/\.md$/)
    // 実ガイドの本文が丸ごと埋め込まれていること（ENOENT 回帰防止）
    expect(profile.guide?.content.length).toBeGreaterThan(1000)
    expect(profile.guide?.content).toContain('Seedance')
  })

  it('leaves guide undefined for families without a guide', () => {
    expect(getOptimizeProfile('kling/v2-1-master').guide).toBeUndefined()
    expect(getOptimizeProfile(undefined).guide).toBeUndefined()
  })
})

describe('formatProfileRulesMarkdown', () => {
  it('renders the profile label, rules and avoid list', () => {
    const profile = getOptimizeProfile('kling/v2-1-master')
    const markdown = formatProfileRulesMarkdown(profile)
    expect(markdown).toContain('Kling')
    expect(markdown).toContain('### ルール')
    expect(markdown).toContain('### 避けること')
  })
})
