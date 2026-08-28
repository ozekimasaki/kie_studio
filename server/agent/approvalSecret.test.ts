// @vitest-environment node
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

process.env.STUDIO_DB_PATH = join(
  mkdtempSync(join(tmpdir(), 'kie-agent-approval-secret-')),
  'studio.db',
)

const { getToolApprovalSecret, TOOL_APPROVAL_SECRET_KEY } = await import('./approvalSecret.ts')
const { deleteSetting, getSetting } = await import('../db/settings.ts')

describe('getToolApprovalSecret', () => {
  it('初回は生成して app_settings に保存し、以後は同じ値を返す', () => {
    deleteSetting(TOOL_APPROVAL_SECRET_KEY)
    const first = getToolApprovalSecret()
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(getSetting(TOOL_APPROVAL_SECRET_KEY)).toBe(first)
    expect(getToolApprovalSecret()).toBe(first)
  })
})
