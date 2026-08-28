import {
  SEEDANCE_GUIDE_CONTENT,
  SEEDANCE_GUIDE_FILE_NAME,
} from './guides/seedance.ts'
import {
  SEEDANCE_2_5_GUIDE_CONTENT,
  SEEDANCE_2_5_GUIDE_FILE_NAME,
} from './guides/seedance-2-5.ts'
import {
  MINIMAX_H3_GUIDE_CONTENT,
  MINIMAX_H3_GUIDE_FILE_NAME,
} from './guides/minimax-h3.ts'

export type OptimizeFamily =
  | 'seedance-2-5'
  | 'seedance'
  | 'kling'
  | 'wan'
  | 'minimax-h3'
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

export type MentionHint =
  | 'at-media'
  | 'at-image'
  | 'bracket-image'
  | 'element'
  | 'none'

export type OptimizeProfile = {
  family: OptimizeFamily
  label: string
  modality: 'image' | 'video'
  /** 埋め込みガイド。設定時は workdir に書き出して Grok CLI に提示する */
  guide?: { fileName: string; content: string }
  formula: string
  mention: MentionHint
  rules: string[]
  avoid: string[]
  targetLength: string
}

const SEEDANCE_GUIDE = {
  fileName: SEEDANCE_GUIDE_FILE_NAME,
  content: SEEDANCE_GUIDE_CONTENT,
}

const SEEDANCE_2_5_GUIDE = {
  fileName: SEEDANCE_2_5_GUIDE_FILE_NAME,
  content: SEEDANCE_2_5_GUIDE_CONTENT,
}

const MINIMAX_H3_GUIDE = {
  fileName: MINIMAX_H3_GUIDE_FILE_NAME,
  content: MINIMAX_H3_GUIDE_CONTENT,
}

const PROFILES: Record<OptimizeFamily, OptimizeProfile> = {
  'seedance-2-5': {
    family: 'seedance-2-5',
    label: 'Seedance 2.5',
    modality: 'video',
    guide: SEEDANCE_2_5_GUIDE,
    formula:
      '[Generation Goal] + [Reference Material Roles] + [Event Script / continuous timeline] + [Maintain Consistency]',
    mention: 'at-media',
    rules: [
      '公式ガイドに従い、通常生成・フレーム参照・storyboard・blockout・編集・延長の主タスクを1つに定める。',
      '参照素材ごとに、対象と参照する性質を @Image N / @Video N / @Audio N で明示する。',
      '素材本体は Grok に渡らない。入力文に明記されていない素材内容や役割を推測しない。',
      '長尺は1ステージ1状態変化で設計する。総尺だけから秒数を発明せず、既存指定がある場合だけ連続した整数秒タイムラインを使う。',
      '人物数、因果、位置関係、小道具の所有、台詞、編集範囲、結末を変えない。',
      '尺・比率・解像度などの生成パラメータは創作プロンプトへ混ぜない。',
    ],
    avoid: [
      '素材の役割や番号の推測・付け替え',
      '複数の主タスクを1プロンプトへ混在',
      '過密なタイムラインや隙間のある時間指定',
      '依頼されていない字幕禁止・品質・安定性の定型句',
      '素材の見た目から人物関係や物語上の事実を推測',
    ],
    targetLength:
      'submit-ready; event density must fit the selected duration (up to 30s)',
  },
  seedance: {
    family: 'seedance',
    label: 'Seedance',
    modality: 'video',
    guide: SEEDANCE_GUIDE,
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
  'minimax-h3': {
    family: 'minimax-h3',
    label: 'MiniMax H3',
    modality: 'video',
    guide: MINIMAX_H3_GUIDE,
    formula:
      '[T2VA | I2VA | FL2VA | L2VA | ref] + (base 3 fields | ref 6 sections) + shots/camera/dialogue',
    mention: 'at-media',
    rules: [
      '公式タスクを1つに定める。text-to-video は T2VA。image-to-video は first のみ I2VA、first+last は FL2VA、last のみ L2VA。reference-to-video は ref の6節。',
      'Studio の @imageN / @VideoN / @AudioN は形式と番号を維持し、同じ番号の <Picture N> / <Video N> / <Audio N> を併用する。無い素材番号は捏造しない。',
      'base は integrated_multimodal_description / overall_soundscape / non_diegetic_music。I2VA・FL2VA・L2VA は先頭に公式の整列文を置く。',
      'ref は subject_definitions → summary → retention_analysis → detailed_description → 音の2節。ラベルは定義してから使う。',
      '台詞は <d>[Language] 原文</d>。話者に (S1) を付け、オフスクリーンは says in an off-screen voiceover と唇を閉じる。翻訳や言い換えをしない。',
      'BGM が不要なら non_diegetic_music: N/A。否定語で音楽や顔の固定を指示しない。',
      '服と顔は別 Subject にし、<Subject 1> is wearing <Subject 2> と結ぶ。定義にはそのショットで見える属性だけ書く。',
      '尺・比率・解像度は創作本文へ混ぜない。ユーザーが時刻を書いていないショットへ秒数を発明しない。4〜15秒に収まる密度にする。',
    ],
    avoid: [
      'Hailuo / 汎用ビデオ向けの短い自然文への潰し',
      'Studio タグの削除や番号の付け替え、公式ラベルとの番号ずれ',
      "no music / don't change などの否定制御",
      '複数アセットを1つの Subject へ雑に束ねる',
      '短い尺への台詞の詰め込み',
      '身長の small / smaller（子ども化）',
    ],
    targetLength:
      'submit-ready; fit 4–15s and ≤7000 characters; denser than generic video',
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

  if (/seedance(?:[-_.]?2[-_.]?5)/.test(id)) return 'seedance-2-5'
  if (id.includes('seedance')) return 'seedance'
  if (id.includes('kling')) return 'kling'
  if (id.startsWith('wan/') || id.includes('/wan')) return 'wan'
  if (/minimax[-_.]?h3/.test(id)) return 'minimax-h3'
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

export function formatProfileRulesMarkdown(profile: OptimizeProfile): string {
  const mentionLine =
    profile.family === 'minimax-h3'
      ? '参照記法: Studio の `@imageN` / `@VideoN` / `@AudioN` を維持し、公式の `<Picture N>` / `<Video N>` / `<Audio N>` を同じ番号で併用（あれば）'
      : profile.mention === 'at-media'
        ? '参照記法: `@Image N` / `@Video N` / `@Audio N` の入力形式と番号を維持（あれば）'
        : profile.mention === 'at-image'
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
