import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../..')

export type OptimizeFamily =
  | 'seedance'
  | 'kling'
  | 'wan'
  | 'hailuo'
  | 'happyhorse'
  | 'grok-imagine'
  | 'seedream'
  | 'flux'
  | 'ideogram'
  | 'imagen'
  | 'nano-banana'
  | 'gpt-image'
  | 'qwen'
  | 'generic-video'
  | 'generic-image'

export type MentionHint = 'at-image' | 'bracket-image' | 'element' | 'none'

export type OptimizeProfile = {
  family: OptimizeFamily
  label: string
  modality: 'image' | 'video'
  /** Relative path from repo root; copied into workdir when set */
  guideFile?: string
  formula: string
  mention: MentionHint
  rules: string[]
  avoid: string[]
  targetLength: string
}

const SEEDANCE_GUIDE = 'Seedance_2.0_Complete_Prompting_Guide_JA.md'

const PROFILES: Record<OptimizeFamily, OptimizeProfile> = {
  seedance: {
    family: 'seedance',
    label: 'Seedance',
    modality: 'video',
    guideFile: SEEDANCE_GUIDE,
    formula:
      '[Subject], [Action], in [Environment], camera [Camera Movement], style [Style], avoid [Constraints]',
    mention: 'at-image',
    rules: [
      '監督として書く。あいまいな形容詞より、物理・動き・カメラを具体化する。',
      'カメラ指示は原則1つ。@image1 / @Video1 などの参照タグは入力にあれば維持する。',
      'Edit（既存動画の直接変更）と Reference（性質の参照）を混同しない。',
      '目標はおおよそ60〜100語。短すぎ・長すぎを避ける。',
    ],
    avoid: [
      'cool / epic / amazing など空虚な修飾',
      '複数カメラ指示の同時指定',
      '参照タグの削除や番号の付け替え',
    ],
    targetLength: '60–100 words (or equivalent Japanese density)',
  },
  kling: {
    family: 'kling',
    label: 'Kling',
    modality: 'video',
    formula:
      'Subject + Subject Movement + Scene + (Camera Language + Lighting + Atmosphere)',
    mention: 'at-image',
    rules: [
      '公式構造に沿う: 被写体 → 被写体の動き → 場面 → カメラ言語 / 照明 / 雰囲気。',
      'カメラ移動は1ショットにつき1つ（slow push-in / tracking / pan など）。複合は避ける。',
      '単純な語彙と短い文。5〜10秒で完結する動きに絞る。',
      'I2V の場合は見た目の再記述より「何がどう動くか」を優先する。',
      '@image1 や @element_name があれば維持する。',
      'negative 向けの除外は本文に混ぜず、必要なら簡潔な avoid 句に留める。',
    ],
    avoid: [
      'vague "cinematic" only',
      'two camera moves in one shot',
      'overly complex physics in one clip',
    ],
    targetLength: '40–90 words; keep motion completable in ~5–10s',
  },
  wan: {
    family: 'wan',
    label: 'Wan',
    modality: 'video',
    formula:
      'Subject + Action + Environment + Camera + Lighting + Style + Motion (+ Output Intent)',
    mention: 'at-image',
    rules: [
      '階層的に書く: 主体 → 主アクション（動詞1つ）→ 環境 → カメラ → 照明 → スタイル → モーション。',
      'T2V はシーン全体、I2V は動きとカメラ変化を優先し画像の再描写を減らす。',
      'カメラ動詞は1つ（push / pull / orbit / track / tilt / crane）。',
      '主モーションと副次モーション（環境の揺れなど）を分けて書く。',
      '矛盾するスタイル語を同時に入れない。目標はおおよそ80〜120語。',
    ],
    avoid: [
      'static image description with no motion (for T2V)',
      're-describing the whole uploaded image (for I2V)',
      'multiple conflicting moods',
    ],
    targetLength: '80–120 words',
  },
  hailuo: {
    family: 'hailuo',
    label: 'Hailuo',
    modality: 'video',
    formula:
      'Subject + Action + Environment + Camera + Mood; keep physics plausible',
    mention: 'at-image',
    rules: [
      '自然な物理と連続した動きを優先する（慣性・布・髪・煙など）。',
      '1つの明確なアクションと1つのカメラ意図に絞る。',
      'I2V では見た目より動きの指示を厚くする。',
      '過度に長いショットリストや複数カット指示は避ける。',
    ],
    avoid: ['conflicting actions', 'extreme camera chaos', 'empty hype adjectives'],
    targetLength: '40–80 words',
  },
  happyhorse: {
    family: 'happyhorse',
    label: 'HappyHorse',
    modality: 'video',
    formula: 'Subject + Action + Scene + Camera; use [Image N] when referencing media',
    mention: 'bracket-image',
    rules: [
      '参照画像は [Image 1] / [Image 2] 形式を使い、media 配列順と一致させる。',
      '参照時は「[Image 1] の赤い旗袍の女性」のように対象を明示する。',
      '非中文は約5000字、中文は約2500字上限を意識し、冗長な繰り返しを削る。',
      '動きとカメラを具体化し、空虚な修飾を減らす。',
    ],
    avoid: [
      'switching to @image style for this family',
      'renumbering Image references',
      'exceeding language length limits with filler',
    ],
    targetLength: 'keep concise; respect HappyHorse length limits',
  },
  'grok-imagine': {
    family: 'grok-imagine',
    label: 'Grok Imagine',
    modality: 'video',
    formula: 'Clear subject + action + scene + camera; preserve @image(n) mentions',
    mention: 'at-image',
    rules: [
      '参照は @image1 形式（スペース付き）を維持する。',
      '映像なら動きとカメラを明示。静止画モデルなら構図・光・素材感を厚くする。',
      '短く具体的に。矛盾するスタイル指定を避ける。',
    ],
    avoid: ['dropping @image mentions', 'vague cinematic-only prompts'],
    targetLength: '30–80 words',
  },
  seedream: {
    family: 'seedream',
    label: 'Seedream',
    modality: 'image',
    formula: 'Subject + details + composition + lighting + style + quality cues',
    mention: 'at-image',
    rules: [
      '被写体の見た目・構図・照明・スタイルを具体化する。',
      '編集系では変更点を明確にし、維持したい要素も書く。',
      '参照がある場合は @image 記法を維持する。',
    ],
    avoid: ['empty adjectives only', 'conflicting art styles'],
    targetLength: '40–100 words',
  },
  flux: {
    family: 'flux',
    label: 'FLUX',
    modality: 'image',
    formula: 'Subject + attributes + composition + lighting + style',
    mention: 'none',
    rules: [
      '自然な英語の描写文が得意。具体的な視覚ディテールを優先する。',
      '構図（close-up / wide / rule of thirds）と光を明示する。',
      'スタイルは1系統に揃える。',
    ],
    avoid: ['keyword salad', 'contradictory styles'],
    targetLength: '30–80 words',
  },
  ideogram: {
    family: 'ideogram',
    label: 'Ideogram',
    modality: 'image',
    formula:
      'Subject + layout + typography (if any) + style; keep text-in-image explicit',
    mention: 'at-image',
    rules: [
      '画像内テキストがある場合は引用符で正確に指定する。',
      'レイアウト（centered poster / logo lockup 等）を明示する。',
      'MagicPrompt がある前提でも、意図はプロンプト側で明確にする。',
      'negative は本文に長く混ぜない。',
    ],
    avoid: ['ambiguous text content', 'overloading with unrelated subjects'],
    targetLength: '30–90 words',
  },
  imagen: {
    family: 'imagen',
    label: 'Imagen',
    modality: 'image',
    formula: 'Subject + setting + composition + lighting + style',
    mention: 'none',
    rules: [
      '明確で具体的な英語描写。写真的な光と構図を書く。',
      '除外したい要素は本文の avoid 句に短く、またはユーザーが negative_prompt 欄を使う前提で本文を汚さない。',
    ],
    avoid: ['keyword spam', 'conflicting photographic styles'],
    targetLength: '30–70 words',
  },
  'nano-banana': {
    family: 'nano-banana',
    label: 'Nano Banana',
    modality: 'image',
    formula: 'Subject + edit intent + preserve constraints + style',
    mention: 'at-image',
    rules: [
      '編集系は「何を変えるか / 何を残すか」を明確にする。',
      '参照画像がある場合は関係を明示し、@image があれば維持する。',
      '短く指示的に。',
    ],
    avoid: ['rewriting the whole scene when only a local edit is needed'],
    targetLength: '20–60 words',
  },
  'gpt-image': {
    family: 'gpt-image',
    label: 'GPT Image',
    modality: 'image',
    formula: 'Natural-language scene description with composition and style',
    mention: 'none',
    rules: [
      '自然文で意図を書く。箇条書きキーワードの羅列より文として通す。',
      '構図・光・素材・スタイルを具体化する。',
      'テキスト描画が必要なら正確な文言を指定する。',
    ],
    avoid: ['comma-separated tag spam'],
    targetLength: '40–100 words',
  },
  qwen: {
    family: 'qwen',
    label: 'Qwen Image',
    modality: 'image',
    formula: 'Subject + details + composition + style; clear edit instructions when editing',
    mention: 'none',
    rules: [
      '生成は具体的な視覚描写、編集は変更点を明示。',
      'スタイル衝突を避ける。',
    ],
    avoid: ['vague requests without visual anchors'],
    targetLength: '30–80 words',
  },
  'generic-video': {
    family: 'generic-video',
    label: 'Video (generic)',
    modality: 'video',
    formula: 'Subject + Action + Environment + Camera + Style',
    mention: 'at-image',
    rules: [
      '動きとカメラを具体化する。1アクション + 1カメラ意図を基本とする。',
      '参照タグ（@image / [Image N] / @element）があれば形式を崩さず維持する。',
    ],
    avoid: ['empty hype words', 'too many simultaneous events'],
    targetLength: '40–90 words',
  },
  'generic-image': {
    family: 'generic-image',
    label: 'Image (generic)',
    modality: 'image',
    formula: 'Subject + details + composition + lighting + style',
    mention: 'none',
    rules: [
      '被写体・構図・光・スタイルを具体化する。',
      '参照や編集指示があれば維持・明確化する。',
    ],
    avoid: ['keyword salad', 'contradictory styles'],
    targetLength: '30–80 words',
  },
}

function isVideoModelId(modelId: string): boolean {
  return /(video|seedance|hailuo|kling|wan\/|happyhorse|omnihuman|lip-sync|avatar)/i.test(
    modelId,
  )
}

export function resolveOptimizeFamily(modelId?: string): OptimizeFamily {
  if (!modelId) return 'generic-video'

  const id = modelId.toLowerCase()

  if (id.includes('seedance')) return 'seedance'
  if (id.includes('kling')) return 'kling'
  if (id.startsWith('wan/') || id.includes('/wan')) return 'wan'
  if (id.includes('hailuo')) return 'hailuo'
  if (id.includes('happyhorse')) return 'happyhorse'
  if (id.includes('grok-imagine')) return 'grok-imagine'
  if (id.includes('seedream')) return 'seedream'
  if (id.includes('flux')) return 'flux'
  if (id.includes('ideogram')) return 'ideogram'
  if (id.includes('imagen')) return 'imagen'
  if (id.includes('nano-banana')) return 'nano-banana'
  if (id.includes('gpt-image')) return 'gpt-image'
  if (id.includes('qwen')) return 'qwen'

  return isVideoModelId(id) ? 'generic-video' : 'generic-image'
}

export function getOptimizeProfile(modelId?: string): OptimizeProfile {
  return PROFILES[resolveOptimizeFamily(modelId)]
}

export function guideAbsolutePath(profile: OptimizeProfile): string | null {
  if (!profile.guideFile) return null
  return resolve(REPO_ROOT, profile.guideFile)
}

export function formatProfileRulesMarkdown(profile: OptimizeProfile): string {
  const mentionLine =
    profile.mention === 'at-image'
      ? '参照記法: `@image1` 形式を維持（あれば）'
      : profile.mention === 'bracket-image'
        ? '参照記法: `[Image 1]` 形式を維持（あれば）'
        : profile.mention === 'element'
          ? '参照記法: `@element_name` 形式を維持（あれば）'
          : '参照記法: 特別なメンション記法なし（入力のタグは壊さない）'

  return [
    `## 最適化プロファイル: ${profile.label} (\`${profile.family}\`)`,
    `モダリティ: ${profile.modality}`,
    `推奨構造: ${profile.formula}`,
    `目標の長さ: ${profile.targetLength}`,
    mentionLine,
    '',
    '### ルール',
    ...profile.rules.map((r) => `- ${r}`),
    '',
    '### 避けること',
    ...profile.avoid.map((a) => `- ${a}`),
  ].join('\n')
}
