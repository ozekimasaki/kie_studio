// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  formatProfileRulesMarkdown,
  getOptimizeProfile,
  resolveOptimizeFamily,
  type OptimizeFamily,
} from './optimize-profiles.ts'

describe('resolveOptimizeFamily', () => {
  it.each([
    ['bytedance/seedance-2-5', 'seedance-2-5'],
    ['bytedance/seedance-2.5', 'seedance-2-5'],
    ['bytedance/seedance-1-5-pro', 'seedance'],
    ['kling/v2-1-master', 'kling'],
    ['kling-3.0/motion-control', 'kling'],
    ['kling/v3-turbo-text-to-video', 'kling'],
    ['wan/v2-2-a14b', 'wan'],
    ['wan/2-6-text-to-video', 'wan'],
    ['wan/2-7-image-to-video', 'wan'],
    ['wan/2-7-image', 'wan-image'],
    ['wan/2-7-image-pro', 'wan-image'],
    ['minimax-h3/text-to-video', 'minimax-h3'],
    ['minimax-h3/image-to-video', 'minimax-h3'],
    ['minimax-h3/reference-to-video', 'minimax-h3'],
    ['minimax_h3/text-to-video', 'minimax-h3'],
    ['minimax/hailuo-02', 'hailuo'],
    ['pixverse-v6/text-to-video', 'pixverse'],
    ['pixverse-v6/transition', 'pixverse'],
    ['pixverse-v6/extend', 'pixverse'],
    ['happyhorse/video-1', 'happyhorse'],
    ['grok-imagine/fast', 'grok-imagine'],
    ['bytedance/seedream-v4', 'seedream'],
    ['flux/kontext-pro', 'flux'],
    ['ideogram/v3', 'ideogram'],
    ['google/imagen-4', 'imagen'],
    ['google/nano-banana-edit', 'nano-banana'],
    ['openai/gpt-image-1', 'gpt-image'],
    ['qwen/image-edit', 'qwen'],
  ] as const)('maps %s to %s', (modelId, family) => {
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
    expect(getOptimizeProfile('minimax/hailuo-02').guide?.content).toContain(
      '[Push in]',
    )
    expect(getOptimizeProfile('minimax/hailuo-02').guide?.fileName).not.toMatch(
      /H3/,
    )
  })

  it.each([
    [
      'kling/v2-1-master',
      'kling',
      ['3.0 / v3-turbo', '@image1', 'Shot 1'],
    ],
    [
      'wan/2-6-text-to-video',
      'wan',
      ['No dialogue.', 'Image 1', '@image1'],
    ],
    [
      'wan/2-7-image',
      'wan-image',
      ['動画 Wan ではない', 'Subject + Setting + Style'],
    ],
    [
      'minimax/hailuo-02',
      'hailuo',
      ['[Push in]', '[Tracking shot]', 'H3 ではない'],
    ],
    [
      'pixverse-v6/text-to-video',
      'pixverse',
      ['50〜80語', '@image1', 'カメラ動きは1つ'],
    ],
    [
      'happyhorse/text-to-video',
      'happyhorse',
      ['[Image 1]', 'character1', '@image'],
    ],
    [
      'grok-imagine/fast',
      'grok-imagine',
      ['@image1', '動き1つ', '30〜80語'],
    ],
    [
      'bytedance/seedream-v4',
      'seedream',
      ['被写体を先に', 'DOUBLE QUOTES', '@imageN'],
    ],
    [
      'flux/kontext-pro',
      'flux',
      ['ネガティブプロンプトは使わない', '#RRGGBB', '30〜80語'],
    ],
    [
      'ideogram/v3',
      'ideogram',
      ['150語以内', 'quotes', '否定は使わない'],
    ],
    [
      'google/imagen-4',
      'imagen',
      ['写真的な英語', 'Nano Banana', '引用符'],
    ],
    [
      'google/nano-banana-edit',
      'nano-banana',
      ['empty street', '@imageN', '監督ブリーフ'],
    ],
    [
      'openai/gpt-image-1',
      'gpt-image',
      ['ALL CAPS', 'keep everything else the same', '@imageN'],
    ],
    [
      'qwen/image-edit',
      'qwen',
      ['Subject + Setting + Style', '漢字・かな', '引用符'],
    ],
  ] as const)(
    'embeds a distinctive guide for %s (%s)',
    (modelId, family, needles) => {
      const profile = getOptimizeProfile(modelId)
      expect(profile.family).toBe(family)
      expect(profile.guide?.fileName).toMatch(/\.md$/)
      expect(profile.guide?.content.length).toBeGreaterThan(200)
      for (const needle of needles) {
        expect(profile.guide?.content).toContain(needle)
      }
    },
  )

  it('leaves guide undefined only for generic families', () => {
    expect(getOptimizeProfile(undefined).guide).toBeUndefined()
    expect(getOptimizeProfile('someone/photo-model-x').guide).toBeUndefined()
    expect(getOptimizeProfile('someone/video-model-x').guide).toBeUndefined()
  })

  it('covers every OptimizeFamily with a profile object', () => {
    const samples: Record<OptimizeFamily, string | undefined> = {
      'seedance-2-5': 'bytedance/seedance-2-5',
      seedance: 'bytedance/seedance-1-5-pro',
      kling: 'kling-3.0/motion-control',
      wan: 'wan/2-7-image-to-video',
      'wan-image': 'wan/2-7-image-pro',
      'minimax-h3': 'minimax-h3/text-to-video',
      hailuo: 'minimax/hailuo-02',
      pixverse: 'pixverse-v6/transition',
      happyhorse: 'happyhorse/text-to-video',
      'grok-imagine': 'grok-imagine/fast',
      seedream: 'bytedance/seedream-v4',
      flux: 'flux/kontext-pro',
      ideogram: 'ideogram/v3',
      imagen: 'google/imagen-4',
      'nano-banana': 'google/nano-banana-edit',
      'gpt-image': 'openai/gpt-image-1',
      qwen: 'qwen/image-edit',
      'generic-video': undefined,
      'generic-image': 'someone/photo-model-x',
    }
    for (const [family, modelId] of Object.entries(samples) as [
      OptimizeFamily,
      string | undefined,
    ][]) {
      expect(getOptimizeProfile(modelId).family).toBe(family)
    }
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

  it('describes Wan dual mention mapping', () => {
    const markdown = formatProfileRulesMarkdown(
      getOptimizeProfile('wan/2-6-text-to-video'),
    )
    expect(markdown).toContain('`Image n`')
    expect(markdown).toContain('`@imageN`')
  })
})
