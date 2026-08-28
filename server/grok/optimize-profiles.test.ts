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
    ['minimax-h3/text-to-video', 'minimax-h3'],
    ['minimax-h3/image-to-video', 'minimax-h3'],
    ['minimax-h3/reference-to-video', 'minimax-h3'],
    ['minimax_h3/text-to-video', 'minimax-h3'],
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

  it('embeds the MiniMax H3 guide for H3 models, not Hailuo', () => {
    const profile = getOptimizeProfile('minimax-h3/reference-to-video')
    expect(profile.family).toBe('minimax-h3')
    expect(profile.label).toBe('MiniMax H3')
    expect(profile.guide?.fileName).toMatch(/H3/)
    expect(profile.guide?.content.length).toBeGreaterThan(1000)
    expect(profile.guide?.content).toContain('integrated_multimodal_description')
    expect(profile.guide?.content).toContain('subject_definitions')
    expect(profile.guide?.content).toContain('non_diegetic_music: N/A')
    expect(profile.guide?.content).toContain('<d>[Japanese]')
    expect(profile.guide?.content).toContain('is wearing')
    expect(profile.guide?.content).toContain('@image1')
    expect(profile.guide?.content).toContain('<Picture 1>')
    expect(getOptimizeProfile('minimax/hailuo-02').family).toBe('hailuo')
    expect(getOptimizeProfile('minimax/hailuo-02').guide).toBeUndefined()
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

  it('describes MiniMax H3 dual mention mapping', () => {
    const markdown = formatProfileRulesMarkdown(
      getOptimizeProfile('minimax-h3/text-to-video'),
    )
    expect(markdown).toContain('MiniMax H3')
    expect(markdown).toContain('`<Picture N>`')
    expect(markdown).toContain('`@imageN`')
  })
})
