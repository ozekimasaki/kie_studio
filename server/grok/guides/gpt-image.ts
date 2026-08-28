// OpenAI 公式 GPT Image prompting guide（Cookbook, 2026-04-21）。
// 取得元:
// - https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide

export const GPT_IMAGE_GUIDE_FILE_NAME = 'GPT_Image_Official_Prompt_Guide_JA.md'

export const GPT_IMAGE_GUIDE_CONTENT = `# GPT Image プロンプト最適化ガイド

gpt-image-1 / 1.5 / 2 共通の公式パターン。背景 → 被写体 → 詳細 → 制約の順。用途（広告、UI、図解）を書いてモードを固定する。

## 最優先原則

1. 材料・形状・テクスチャ・メディア（photo / watercolor / 3D）を具体化する。
2. 実写が必要なら \`photorealistic\` を本文に含める。細かいカメラ型番は雰囲気程度。
3. 編集は \`change only X\` + \`keep everything else the same\`。不変リストを繰り返す。
4. 画面内文字は引用符または ALL CAPS。書体・サイズ・配置。難しい固有名詞は文字ずつ。
5. 複数入力は \`Image 1 (product): ... Image 2 (style): ...\`。Studio の \`@imageN\` があれば維持し番号を揃える。
6. 完成プロンプト本文のみ。quality / size パラメータは本文へ混ぜない。

## 生成テンプレ

\`\`\`text
Scene / background.
Subject and pose.
Important visual details (materials, lighting, layout).
Use case (ad, UI mock, infographic, product cutout).
Constraints (no extra text, preserve identity, ...).
\`\`\`

複雑な依頼は1段落にせず短いラベル付き行に分ける。

## 人

全身が見えるか、視線、手の位置、他物体とのスケールを書く。

## 透明背景

ユーザーが切り抜きを求めたときだけ、被写体を無背景で孤立させ、風景・チェッカー・不要な影を入れないと書く。
`
