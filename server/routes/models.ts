import { Hono } from 'hono'
import type { ModelCategory } from '../kie/types.ts'
import { readCatalog } from '../catalog/sync.ts'

const VALID_CATEGORIES = new Set<ModelCategory>(['image', 'video'])

export const modelsRoutes = new Hono()

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
    return c.json({ error: 'category must be image or video' }, 400)
  }
  const category = categoryRaw as ModelCategory | undefined
  const models = category
    ? catalog.models.filter((m) => m.category === category)
    : catalog.models

  return c.json({
    data: {
      syncedAt: catalog.syncedAt,
      source: catalog.source,
      models,
    },
  })
})
