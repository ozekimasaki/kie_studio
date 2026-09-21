// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { listMergedModels } from './models.ts'

describe('listMergedModels ElevenLabs dialogue', () => {
  it('defaults language_code to empty so automatic detection is preserved', async () => {
    const merged = await listMergedModels()
    expect(merged).not.toBeNull()
    const dialogue = merged!.models.find((model) => model.id === 'market/elevenlabs-dialogue')
    expect(dialogue).toBeDefined()
    const language = dialogue!.fields.find((field) => field.name === 'language_code')
    expect(language).toBeDefined()
    expect(language!.required).toBeFalsy()
    expect(language!.default).toBe('')
    if (language!.type === 'enum') {
      expect(language!.enum?.[0]).toBe('')
    }
  })
})
