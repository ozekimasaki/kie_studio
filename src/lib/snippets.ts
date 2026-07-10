export interface PromptSnippet {
  id: string
  title: string
  text: string
  createdAt: number
}

const KEY = 'kie-studio-snippets'
const MAX_ITEMS = 50

export function loadSnippets(): PromptSnippet[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PromptSnippet[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(items: PromptSnippet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // 容量超過などで保存できない場合は諦める（UI 側の state は維持される）
  }
}

export function addSnippet(title: string, text: string): PromptSnippet[] {
  const item: PromptSnippet = {
    id: `sn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title.trim() || text.trim().slice(0, 24),
    text,
    createdAt: Date.now(),
  }
  const next = [item, ...loadSnippets()].slice(0, MAX_ITEMS)
  save(next)
  return next
}

export function removeSnippet(id: string): PromptSnippet[] {
  const next = loadSnippets().filter((s) => s.id !== id)
  save(next)
  return next
}
