export type ToolLikePart = {
  type: string
  toolName?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
  approval?: { id?: string; approved?: boolean; reason?: string }
}

export function isToolPart(part: { type: string }): part is ToolLikePart {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-')
}

export function toolNameOf(part: ToolLikePart): string {
  if (typeof part.toolName === 'string' && part.toolName) return part.toolName
  if (part.type.startsWith('tool-')) return part.type.slice('tool-'.length)
  return part.type
}

export function approvalIdOf(part: ToolLikePart): string | null {
  const id = part.approval?.id
  return typeof id === 'string' && id ? id : null
}
