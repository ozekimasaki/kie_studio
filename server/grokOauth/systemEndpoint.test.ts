// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GROK_OAUTH_ENDPOINT_ID } from './constants.ts'
import {
  getGrokOauthSystemEndpoint,
  mergeCustomEndpointsWithGrokOauth,
} from './systemEndpoint.ts'

function makeJwt(exp: number): string {
  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ exp })}.sig`
}

describe('systemEndpoint', () => {
  let home: string

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'grok-oauth-sys-'))
    process.env.GROK_OAUTH_PROXY_HOME = home
    process.env.STUDIO_API_BASE = 'http://127.0.0.1:8799'
  })

  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
  })

  it('returns null when not logged in', () => {
    expect(getGrokOauthSystemEndpoint()).toBeNull()
    expect(mergeCustomEndpointsWithGrokOauth([{ id: 'other', label: 'x' }])).toEqual([
      { id: 'other', label: 'x' },
    ])
  })

  it('injects system endpoint ahead of user endpoints when logged in', () => {
    mkdirSync(home, { recursive: true })
    writeFileSync(
      join(home, 'auth.json'),
      JSON.stringify({
        tokens: {
          access_token: makeJwt(Math.floor(Date.now() / 1000) + 3600),
          refresh_token: 'rt',
        },
      }),
    )
    const system = getGrokOauthSystemEndpoint()
    expect(system?.id).toBe(GROK_OAUTH_ENDPOINT_ID)
    expect(system?.system).toBe(true)
    expect(system?.baseUrl).toBe('http://127.0.0.1:8799/api/grok-oauth/v1')

    const merged = mergeCustomEndpointsWithGrokOauth([
      { id: GROK_OAUTH_ENDPOINT_ID, label: 'user clash' },
      { id: 'other', label: 'x' },
    ])
    expect(merged[0]).toMatchObject({ id: GROK_OAUTH_ENDPOINT_ID, system: true })
    expect(merged).toHaveLength(2)
    expect(merged[1]).toEqual({ id: 'other', label: 'x' })
  })
})
