// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeMarketTask } from '../market.ts'
import { normalizeRunwayTask } from './runway.ts'
import { normalizeSunoTask } from './suno.ts'
import { normalizeVeoTask } from './veo.ts'

describe('provider task normalization', () => {
  it('keeps a Market partial result and raw diagnostics', () => {
    const task = normalizeMarketTask('market-1', {
      taskId: 'market-1',
      model: 'elevenlabs/text-to-speech-multilingual-v2',
      state: 'fail',
      resultJson: JSON.stringify({ resultUrls: ['https://cdn.example.com/a.mp3'] }),
      param: '{"text":"hello"}',
      failCode: 'UPSTREAM_PARTIAL',
      failMsg: 'one output failed',
    })
    expect(task.state).toBe('partial')
    expect(task.media[0]).toMatchObject({ kind: 'audio' })
    expect(task.failCode).toBe('UPSTREAM_PARTIAL')
    expect(task.rawResult).toEqual({ resultUrls: ['https://cdn.example.com/a.mp3'] })
  })

  it('normalizes Suno multiple tracks and first-success as partial', () => {
    const task = normalizeSunoTask('suno-1', 'generate', {
      data: {
        taskId: 'suno-1',
        status: 'FIRST_SUCCESS',
        response: {
          sunoData: [
            { id: 'a1', audioUrl: 'https://cdn.example.com/a.mp3', duration: 120, title: 'A' },
            { id: 'a2', streamAudioUrl: 'https://cdn.example.com/b.mp3', duration: 121, title: 'B' },
          ],
        },
      },
    })
    expect(task.state).toBe('partial')
    expect(task.media).toHaveLength(2)
    expect(task.media[0]?.providerAssetId).toBe('a1')
  })

  it('normalizes Veo success and preserves the original payload', () => {
    const payload = {
      data: {
        taskId: 'veo-1',
        successFlag: 1,
        response: { resultUrls: ['https://cdn.example.com/v.mp4'] },
        paramJson: '{"prompt":"orbit"}',
      },
    }
    const task = normalizeVeoTask('veo-1', 'generate', payload)
    expect(task.state).toBe('success')
    expect(task.media[0]?.kind).toBe('video')
    expect(task.rawParam).toEqual({ prompt: 'orbit' })
    expect(task.rawResult).toBe(payload)
  })

  it('marks expired Runway outputs explicitly', () => {
    const task = normalizeRunwayTask('runway-1', 'generate', {
      data: {
        taskId: 'runway-1',
        state: 'success',
        expireFlag: 1,
        videoInfo: { videoId: 'video-1', videoUrl: 'https://cdn.example.com/v.mp4' },
      },
    })
    expect(task.state).toBe('expired')
    expect(task.media[0]?.providerAssetId).toBe('video-1')
  })

  it.each([
    ['market waiting', normalizeMarketTask('m-wait', { state: 'waiting' }).state, 'waiting'],
    ['market failure', normalizeMarketTask('m-fail', { state: 'fail', failMsg: 'nope' }).state, 'fail'],
    ['suno generating', normalizeSunoTask('s-work', 'generate', { data: { status: 'TEXT_SUCCESS' } }).state, 'generating'],
    ['suno failure', normalizeSunoTask('s-fail', 'generate', { data: { status: 'FAILED' } }).state, 'fail'],
    ['veo generating', normalizeVeoTask('v-work', 'generate', { data: { successFlag: 0 } }).state, 'generating'],
    ['veo failure', normalizeVeoTask('v-fail', 'generate', { data: { successFlag: 2 } }).state, 'fail'],
    ['runway waiting', normalizeRunwayTask('r-wait', 'generate', { data: { state: 'wait' } }).state, 'waiting'],
    ['runway failure', normalizeRunwayTask('r-fail', 'generate', { data: { state: 'fail' } }).state, 'fail'],
  ])('normalizes %s', (_label, actual, expected) => {
    expect(actual).toBe(expected)
  })

  it('normalizes generated lyrics as a text result', () => {
    const task = normalizeSunoTask('lyrics-1', 'lyrics', {
      data: { taskId: 'lyrics-1', status: 'SUCCESS', response: { lyrics: 'Verse one' } },
    })
    expect(task.state).toBe('success')
    expect(task.media[0]).toMatchObject({
      kind: 'text',
      metadata: { text: 'Verse one' },
    })
  })
})
