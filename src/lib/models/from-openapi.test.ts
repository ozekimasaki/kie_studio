import { describe, expect, it } from 'vitest'
import { propertyToField } from './from-openapi.ts'

describe('OpenAPI field constraints', () => {
  it('uses explicit prose constraints when the schema omits them', () => {
    const prompt = propertyToField('prompt', {
      type: 'string',
      description: 'Required field. (Max length: 20,000 characters)',
    })
    expect(prompt).toMatchObject({ required: true, maxLength: 20_000 })

    const duration = propertyToField('duration', {
      type: 'number',
      description: 'Video duration in 4-15 seconds.',
    })
    expect(duration).toMatchObject({ min: 4, max: 15 })
  })
})
