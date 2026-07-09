import { Hono } from 'hono'
import type { ModelCategory } from '../kie/types.ts'
import { CATALOG_PATH, readCatalog } from '../catalog/sync.ts'

export const modelsRoutes = new Hono()

modelsRoutes.get('/models', async (c) => {
  const catalog = await readCatalog()
  if (!catalog) {
    return c.json(
      {
        error: `Catalog not found at ${CATALOG_PATH}. Wait for startup sync or run npm run sync:models`,
      },
      503,
    )
  }

  const category = c.req.query('category') as ModelCategory | null
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
