// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { runtimeCatalogSyncOptions } from './runtime-sync.ts'

const ORIGINAL_FORCE = process.env.SYNC_MODELS_FORCE

afterEach(() => {
  if (ORIGINAL_FORCE === undefined) delete process.env.SYNC_MODELS_FORCE
  else process.env.SYNC_MODELS_FORCE = ORIGINAL_FORCE
})

describe('runtimeCatalogSyncOptions', () => {
  it('keeps the 12h window for local dev', () => {
    delete process.env.SYNC_MODELS_FORCE
    expect(runtimeCatalogSyncOptions('dev')).toEqual({
      force: false,
      maxAgeMs: undefined,
    })
  })

  it('always rechecks llms.txt on packaged desktop', () => {
    delete process.env.SYNC_MODELS_FORCE
    expect(runtimeCatalogSyncOptions('desktop')).toEqual({
      force: false,
      maxAgeMs: 0,
    })
  })

  it('honors SYNC_MODELS_FORCE on both runtimes', () => {
    process.env.SYNC_MODELS_FORCE = '1'
    expect(runtimeCatalogSyncOptions('dev')).toEqual({
      force: true,
      maxAgeMs: 0,
    })
    expect(runtimeCatalogSyncOptions('desktop')).toEqual({
      force: true,
      maxAgeMs: 0,
    })
  })
})
