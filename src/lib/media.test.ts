import { describe, expect, it } from 'vitest'
import { replaceMatchingAsset, sameMediaAsset } from './media.ts'

describe('sameMediaAsset', () => {
  it('matches the same object', () => {
    const asset = { url: 'https://cdn.example.com/a.mp3' }
    expect(sameMediaAsset(asset, asset)).toBe(true)
  })

  it('matches reconstructed resultUrl assets with the same url', () => {
    expect(
      sameMediaAsset(
        { url: 'https://cdn.example.com/a.mp3' },
        { url: 'https://cdn.example.com/a.mp3' },
      ),
    ).toBe(true)
  })

  it('matches by providerAssetId when urls were refreshed', () => {
    expect(
      sameMediaAsset(
        {
          providerAssetId: 'suno-1',
          url: 'https://tos.example/expired.mp3',
        },
        {
          providerAssetId: 'suno-1',
          url: 'https://tos.example/fresh.mp3',
        },
      ),
    ).toBe(true)
  })

  it('does not match unrelated assets', () => {
    expect(
      sameMediaAsset(
        { url: 'https://cdn.example.com/a.mp3' },
        { url: 'https://cdn.example.com/b.mp3' },
      ),
    ).toBe(false)
  })
})

describe('replaceMatchingAsset', () => {
  it('replaces reconstructed playlist entries that share a url', () => {
    const original = { kind: 'audio' as const, url: 'https://cdn.example.com/a.mp3' }
    const sibling = { kind: 'audio' as const, url: 'https://cdn.example.com/b.mp3' }
    const playable = { ...original, url: 'https://cdn.example.com/fresh-a.mp3' }
    expect(replaceMatchingAsset([original, sibling], { url: original.url }, playable)).toEqual([
      playable,
      sibling,
    ])
  })
})
