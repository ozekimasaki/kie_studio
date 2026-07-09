import type { Catalog, ModelCategory, ModelDefinition } from './types.ts'
import catalogJson from '../../data/catalog.json'

export function loadCatalog(): Catalog {
  return catalogJson as Catalog
}

export function getModelsByCategory(
  category: ModelCategory,
): ModelDefinition[] {
  return loadCatalog().models.filter((m) => m.category === category)
}

export function getModelById(id: string): ModelDefinition | undefined {
  return loadCatalog().models.find((m) => m.id === id || m.model === id)
}
