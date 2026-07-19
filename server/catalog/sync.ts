/**
 * Sync Market IMAGE/VIDEO/AUDIO models from docs.kie.ai into src/data/catalog.json
 */
import { createHash } from 'node:crypto'
import { writeFile, mkdir, readFile, stat } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import {
  detectCategory,
  extractInputSchema,
  extractModelSlug,
  extractOpenApiFromMarkdown,
  inputSchemaToFields,
} from '../../src/lib/models/from-openapi.ts'
import type { Catalog, ModelDefinition } from '../../src/lib/models/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const CATALOG_PATH = resolve(__dirname, '../../src/data/catalog.json')
const LLMS_TXT = 'https://docs.kie.ai/llms.txt'
const FETCH_TIMEOUT_MS = 15_000
const DEFAULT_CONCURRENCY = 12

const EXCLUDE_RE =
  /(suno|chat|claude|common-api|file-upload|webhook|quickstart|callback|cn\/|gpt-codex|\/gemini\/|\/grok\/grok-4|get-task-detail)/i

const VIDEO_HINT_RE =
  /(video|kling|seedance|hailuo|sora|wan\/|infinitalk|omnihuman|happyhorse|grok-imagine\/.*video)/i

const AUDIO_HINT_RE =
  /(audio|speech|voice|dialogue|tts|elevenlabs|music|sound|vocal|noise|stem)/i

function parseLlmsLinks(text: string): { title: string; url: string }[] {
  const links: { title: string; url: string }[] = []
  const re = /\[([^\]]+)\]\((https:\/\/docs\.kie\.ai\/[^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    links.push({ title: m[1]!, url: m[2]!.replace(/\.md$/, '') })
  }
  return links
}

function isMarketModelPage(url: string, title: string): boolean {
  if (!url.includes('/market/')) return false
  if (EXCLUDE_RE.test(url) || EXCLUDE_RE.test(title)) return false
  if (url.includes('/cn/')) return false
  return true
}

function hashText(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function resolveConcurrency(): number {
  const raw = process.env.SYNC_CONCURRENCY
  if (!raw) return DEFAULT_CONCURRENCY
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CONCURRENCY
  return Math.min(n, 32)
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: 'text/plain, text/markdown, */*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`)
  return res.text()
}

function pickBodySchema(
  doc: Record<string, unknown>,
): Record<string, unknown> | null {
  const paths = doc.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return null
  for (const pathItem of Object.values(paths)) {
    const post = pathItem.post as Record<string, unknown> | undefined
    if (!post) continue
    const body = post.requestBody as Record<string, unknown> | undefined
    const content = body?.content as
      | Record<string, Record<string, unknown>>
      | undefined
    const schema = content?.['application/json']?.schema as
      | Record<string, unknown>
      | undefined
    if (schema) return schema
  }
  return null
}

async function parseModelPage(
  title: string,
  url: string,
  quiet: boolean,
): Promise<ModelDefinition | null> {
  const mdUrl = url.endsWith('.md') ? url : `${url}.md`
  let markdown: string
  try {
    markdown = await fetchText(mdUrl)
  } catch {
    try {
      markdown = await fetchText(url)
    } catch {
      if (!quiet) console.warn(`  skip (fetch): ${url}`)
      return null
    }
  }

  const yamlText = extractOpenApiFromMarkdown(markdown)
  if (!yamlText) {
    if (!quiet) console.warn(`  skip (no openapi): ${url}`)
    return null
  }

  let doc: Record<string, unknown>
  try {
    doc = parseYaml(yamlText) as Record<string, unknown>
  } catch {
    if (!quiet) console.warn(`  skip (yaml): ${url}`)
    return null
  }

  const bodySchema = pickBodySchema(doc)
  if (!bodySchema) {
    if (!quiet) console.warn(`  skip (no body): ${url}`)
    return null
  }

  const model = extractModelSlug(bodySchema)
  if (!model) {
    if (!quiet) console.warn(`  skip (no model slug): ${url}`)
    return null
  }

  const input = extractInputSchema(bodySchema)
  const fields = inputSchemaToFields(input)
  const hints = `${url} ${title} ${model}`
  const category = VIDEO_HINT_RE.test(hints)
    ? 'video'
    : AUDIO_HINT_RE.test(hints)
      ? 'audio'
      : detectCategory(`${url} ${title}`, model)

  return {
    id: model,
    model,
    title: title.replace(/\s+/g, ' ').trim(),
    category,
    provider: 'market',
    docsUrl: url,
    fields,
  }
}

/** Run async work over items with a fixed concurrency pool. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index]!, index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

/** In-memory catalog cache — avoids readFile+JSON.parse on every /api/models. */
let cachedCatalog: Catalog | null | undefined
let cachedCatalogMtimeMs: number | undefined

function setCachedCatalog(catalog: Catalog | null): void {
  cachedCatalog = catalog
}

export async function readCatalog(): Promise<Catalog | null> {
  try {
    const info = await stat(CATALOG_PATH)
    if (
      cachedCatalog !== undefined &&
      cachedCatalogMtimeMs === info.mtimeMs
    ) return cachedCatalog
    const raw = await readFile(CATALOG_PATH, 'utf8')
    const catalog = JSON.parse(raw) as Catalog
    setCachedCatalog(catalog)
    cachedCatalogMtimeMs = info.mtimeMs
    return catalog
  } catch {
    setCachedCatalog(null)
    cachedCatalogMtimeMs = undefined
    return null
  }
}

export function catalogAgeMs(catalog: Catalog | null): number | null {
  if (!catalog?.syncedAt) return null
  const t = Date.parse(catalog.syncedAt)
  if (Number.isNaN(t)) return null
  return Date.now() - t
}

export interface SyncOptions {
  /** Skip network sync if catalog is fresher than this (ms). Default: 12h */
  maxAgeMs?: number
  /** Force sync even if fresh */
  force?: boolean
  /** Less console noise */
  quiet?: boolean
}

export interface SyncResult {
  skipped: boolean
  reason?: string
  catalog?: Catalog
}

export async function syncCatalog(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const maxAgeMs = options.maxAgeMs ?? 12 * 60 * 60 * 1000
  const quiet = options.quiet ?? false
  const existing = await readCatalog()

  if (!options.force) {
    const age = catalogAgeMs(existing)
    if (age !== null && age < maxAgeMs) {
      const hours = (age / 3_600_000).toFixed(1)
      return {
        skipped: true,
        reason: `catalog is fresh (${hours}h old)`,
        catalog: existing ?? undefined,
      }
    }
  }

  if (!quiet) console.log('[catalog] Fetching llms.txt...')
  const llmsStarted = Date.now()
  const llms = await fetchText(LLMS_TXT)
  const sourceHash = hashText(llms)
  if (!quiet) {
    console.log(
      `[catalog] llms.txt fetched in ${((Date.now() - llmsStarted) / 1000).toFixed(1)}s`,
    )
  }

  if (
    !options.force &&
    existing?.sourceHash &&
    existing.sourceHash === sourceHash
  ) {
    return {
      skipped: true,
      reason: 'llms.txt unchanged',
      catalog: existing,
    }
  }

  const links = parseLlmsLinks(llms).filter((l) =>
    isMarketModelPage(l.url, l.title),
  )

  const seen = new Set<string>()
  const unique = links.filter((l) => {
    if (seen.has(l.url)) return false
    seen.add(l.url)
    return true
  })

  const concurrency = resolveConcurrency()
  if (!quiet) {
    console.log(
      `[catalog] Found ${unique.length} candidate pages (concurrency=${concurrency})`,
    )
  }

  const pagesStarted = Date.now()
  let completed = 0
  const results = await mapPool(unique, concurrency, async (l) => {
    const model = await parseModelPage(l.title, l.url, quiet)
    completed++
    if (!quiet) {
      process.stdout.write(
        `  [${completed}/${unique.length}] ${l.title}\n`,
      )
    }
    return model
  })

  const models = results.filter((r): r is ModelDefinition => r !== null)
  const pagesElapsed = ((Date.now() - pagesStarted) / 1000).toFixed(1)
  if (!quiet) {
    console.log(
      `[catalog] Fetched ${unique.length} pages in ${pagesElapsed}s (${models.length} parsed)`,
    )
  }

  const byId = new Map<string, ModelDefinition>()
  for (const m of models) {
    const prev = byId.get(m.id)
    if (!prev || m.fields.length > prev.fields.length) byId.set(m.id, m)
  }

  const sorted = [...byId.values()].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.title.localeCompare(b.title)
  })

  // 全ページパース失敗時に既存の有効 catalog を空で潰さない
  if (sorted.length === 0 && (existing?.models.length ?? 0) > 0) {
    if (!quiet) {
      console.warn(
        `[catalog] Parsed 0 models; keeping existing catalog (${existing!.models.length} models)`,
      )
    }
    return {
      skipped: true,
      reason: 'parsed 0 models; kept existing catalog',
      catalog: existing!,
    }
  }

  const catalog: Catalog = {
    syncedAt: new Date().toISOString(),
    source: 'docs.kie.ai/llms.txt',
    sourceHash,
    models: sorted,
  }

  await mkdir(dirname(CATALOG_PATH), { recursive: true })
  await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  setCachedCatalog(catalog)

  if (!quiet) {
    console.log(
      `[catalog] Wrote ${sorted.length} models (${sorted.filter((m) => m.category === 'image').length} image, ${sorted.filter((m) => m.category === 'video').length} video, ${sorted.filter((m) => m.category === 'audio').length} audio)`,
    )
  }

  return { skipped: false, catalog }
}
