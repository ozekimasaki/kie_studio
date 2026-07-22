// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const MASTER_KEY = randomBytes(32).toString('base64')

describe('secretBox encryption', () => {
  beforeAll(() => {
    process.env.STUDIO_SECRET_KEY = MASTER_KEY
  })

  it('round-trips a secret through the enc:v1 envelope', async () => {
    const { encryptSecret, decryptSecret, isEncrypted } = await import(
      './secretBox.ts'
    )
    const secret = 'sk-live-abcdef1234567890'
    const sealed = encryptSecret(secret)
    expect(isEncrypted(sealed)).toBe(true)
    expect(sealed).not.toContain(secret)
    expect(decryptSecret(sealed)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', async () => {
    const { encryptSecret } = await import('./secretBox.ts')
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('returns legacy plaintext (no prefix) unchanged', async () => {
    const { decryptSecret } = await import('./secretBox.ts')
    expect(decryptSecret('plain-legacy-key')).toBe('plain-legacy-key')
  })

  it('throws when the payload is authenticated with the wrong key', async () => {
    const { encryptSecret } = await import('./secretBox.ts')
    const sealed = encryptSecret('secret')
    process.env.STUDIO_SECRET_KEY = randomBytes(32).toString('base64')
    const { decryptSecret } = await import('./secretBox.ts')
    expect(() => decryptSecret(sealed)).toThrow()
    process.env.STUDIO_SECRET_KEY = MASTER_KEY
  })
})

describe('API key store', () => {
  let dbDir: string

  beforeAll(() => {
    dbDir = mkdtempSync(join(tmpdir(), 'kie-apikey-'))
    process.env.STUDIO_DB_PATH = join(dbDir, 'studio.db')
    process.env.STUDIO_SECRET_KEY = MASTER_KEY
    delete process.env.KIE_API_KEY
  })

  afterAll(() => {
    rmSync(dbDir, { recursive: true, force: true })
  })

  it('persists the key encrypted at rest and reads it back decrypted', async () => {
    const { setStoredApiKey, getStoredApiKey, hasStoredApiKeyInStore } =
      await import('./apiKey.ts')
    const { getSetting } = await import('../db/settings.ts')
    const { isEncrypted } = await import('./secretBox.ts')

    setStoredApiKey('sk-secret-value-9999')

    // Raw column must not contain the plaintext key.
    const raw = getSetting('KIE_API_KEY')
    expect(raw).not.toBeNull()
    expect(isEncrypted(raw as string)).toBe(true)
    expect(raw).not.toContain('sk-secret-value-9999')

    expect(getStoredApiKey()).toBe('sk-secret-value-9999')
    expect(hasStoredApiKeyInStore()).toBe(true)
  })
})
