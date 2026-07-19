import { Hono } from 'hono'
import type { FieldSchema, ModelCategory, ModelDefinition } from '../kie/types.ts'
import { readCatalog } from '../catalog/sync.ts'
import { DEDICATED_MODELS } from '../catalog/dedicated.ts'

const VALID_CATEGORIES = new Set<ModelCategory>(['image', 'video', 'audio'])

export const modelsRoutes = new Hono()

function withUseCase(model: ModelDefinition) {
  if (model.useCase) return model
  const hay = `${model.title} ${model.model}`.toLowerCase()
  if (model.category === 'audio') {
    if (/dialogue|conversation/.test(hay)) return { ...model, useCase: '会話' }
    if (/tts|speech|voice|narrat/.test(hay)) return { ...model, useCase: 'ナレーション' }
    if (/noise|separat|isolation|stem|enhance/.test(hay)) return { ...model, useCase: '音声処理' }
    return { ...model, useCase: '楽曲' }
  }
  if (model.category === 'video') {
    if (/upscale|enhance|4k|1080/.test(hay)) return { ...model, useCase: '高画質化' }
    if (/edit|video-to-video|lip.sync/.test(hay)) return { ...model, useCase: '映像編集' }
    return { ...model, useCase: '映像生成' }
  }
  if (/edit|image-to-image|inpaint|outpaint/.test(hay)) return { ...model, useCase: '画像編集' }
  return { ...model, useCase: '画像生成' }
}

function hydrateDedicatedModel(
  dedicated: ModelDefinition,
  catalogModels: ModelDefinition[],
): ModelDefinition {
  if (dedicated.provider !== 'market') return dedicated
  const catalogModel = catalogModels.find(
    (candidate) => candidate.provider === 'market' && candidate.model === dedicated.model,
  )
  if (!catalogModel) return dedicated

  const fields = catalogModel.fields.map((field): FieldSchema => {
    if (dedicated.id === 'market/elevenlabs-tts' && field.name === 'text') {
      return {
        ...field,
        label: '原稿',
        description: '空行で最大5000文字ずつのセグメントに分けます',
        maxLength: 20_000,
      }
    }
    if (dedicated.id === 'market/elevenlabs-dialogue' && field.name === 'stability') {
      return { ...field, min: 0, max: 1, step: 0.5, default: 0.5 }
    }
    if (dedicated.id === 'market/volcengine-lip-sync' && field.name === 'video_url') {
      return { ...field, accept: 'video/*', maxItems: 1, scalar: true }
    }
    if (dedicated.id === 'market/volcengine-lip-sync' && field.name === 'audio_url') {
      return { ...field, accept: 'audio/*', maxItems: 1, scalar: true }
    }
    return field
  })

  return {
    ...catalogModel,
    id: dedicated.id,
    title: dedicated.title,
    operation: dedicated.operation,
    useCase: dedicated.useCase,
    tags: dedicated.tags,
    docsUrl: dedicated.docsUrl ?? catalogModel.docsUrl,
    fields,
  }
}

modelsRoutes.get('/models', async (c) => {
  const catalog = await readCatalog()
  if (!catalog) {
    return c.json(
      {
        error:
          'Catalog not found. Wait for startup sync or run npm run sync:models',
      },
      503,
    )
  }

  const categoryRaw = c.req.query('category')
  if (categoryRaw && !VALID_CATEGORIES.has(categoryRaw as ModelCategory)) {
    return c.json({ error: 'category must be image, video or audio' }, 400)
  }
  const category = categoryRaw as ModelCategory | undefined
  const dedicatedModels = DEDICATED_MODELS.map((model) =>
    hydrateDedicatedModel(model, catalog.models),
  )
  const allModels = [...dedicatedModels, ...catalog.models].filter(
    (model, index, items) => items.findIndex(
      (item) => item.provider === model.provider && item.model === model.model,
    ) === index,
  ).map(withUseCase)
  const models = category
    ? allModels.filter((m) => m.category === category)
    : allModels

  return c.json({
    data: {
      syncedAt: catalog.syncedAt,
      source: catalog.source,
      models,
    },
  })
})
