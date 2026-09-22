import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MediaAsset } from '../../lib/models/types.ts'
import { fetchDownloadUrl } from '../../lib/api.ts'
import { AudioPlayerProvider } from './AudioPlayer.tsx'
import { useAudioPlayer } from './audioPlayerContext.ts'

vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>()
  return {
    ...actual,
    fetchDownloadUrl: vi.fn(),
  }
})

function Page({ label }: { label: string }) {
  const player = useAudioPlayer()
  return (
    <div>
      <span>{label}</span>
      <button type="button" onClick={() => player.play({
        kind: 'audio',
        url: `https://cdn.example.com/${label}.mp3`,
        title: label,
      })}>
        {label}を再生
      </button>
    </div>
  )
}

function expiredUrl(name: string): string {
  return `https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/${name}.mp3?X-Tos-Date=20200101T000000Z&X-Tos-Expires=1&X-Tos-Signature=sig`
}

function PlaylistHarness() {
  const player = useAudioPlayer()
  const expiredA = expiredUrl('a')
  const expiredB = expiredUrl('b')
  return (
    <button
      type="button"
      onClick={() => {
        const playlist: MediaAsset[] = [
          { kind: 'audio', url: expiredA, title: 'A' },
          { kind: 'audio', url: expiredB, title: 'B' },
        ]
        player.play({ ...playlist[0]! }, playlist.map((item) => ({ ...item })))
      }}
    >
      プレイリスト再生
    </button>
  )
}

function LyricsHarness({ expired, useStartAt }: { expired: boolean; useStartAt?: boolean }) {
  const player = useAudioPlayer()
  const url = expired
    ? expiredUrl('lyric')
    : 'https://cdn.example.com/lyric.mp3'
  return (
    <button
      type="button"
      onClick={() => {
        if (useStartAt) {
          player.play({ kind: 'audio', url, title: 'Lyric' }, undefined, { startAt: 12 })
          return
        }
        player.play({ kind: 'audio', url, title: 'Lyric' })
        player.seek(12)
      }}
    >
      歌詞シーク
    </button>
  )
}

function RaceHarness() {
  const player = useAudioPlayer()
  return (
    <div>
      <button
        type="button"
        onClick={() => player.play({ kind: 'audio', url: expiredUrl('stale'), title: 'Expired' })}
      >
        期限切れを再生
      </button>
      <button
        type="button"
        onClick={() => player.play({
          kind: 'audio',
          url: 'https://cdn.example.com/fresh-local.mp3',
          title: 'Fresh',
        })}
      >
        新しい曲を再生
      </button>
    </div>
  )
}

describe('AudioPlayerProvider', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.mocked(fetchDownloadUrl).mockReset()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
  })

  it('keeps one player and the active track while page content changes', () => {
    const view = render(
      <AudioPlayerProvider><Page label="A" /></AudioPlayerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Aを再生' }))
    expect(screen.getByText('A', { selector: 'p' })).toBeInTheDocument()

    view.rerender(
      <AudioPlayerProvider><Page label="B" /></AudioPlayerProvider>,
    )
    expect(screen.getByText('A', { selector: 'p' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bを再生' }))
    expect(screen.getByText('B', { selector: 'p' })).toBeInTheDocument()
    expect(view.container.querySelectorAll('audio')).toHaveLength(1)
  })

  it('skips to the next reconstructed track after a signed URL refresh', async () => {
    vi.mocked(fetchDownloadUrl).mockImplementation(async (url: string) => ({
      data: {
        downloadUrl: url.includes('/a.mp3')
          ? 'https://cdn.example.com/fresh-a.mp3'
          : 'https://cdn.example.com/fresh-b.mp3',
      },
    }))

    render(
      <AudioPlayerProvider>
        <PlaylistHarness />
      </AudioPlayerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'プレイリスト再生' }))
    await waitFor(() => {
      expect(screen.getByText('A', { selector: 'p' })).toBeInTheDocument()
    })

    const skip = await screen.findByRole('button', { name: '次のトラック' })
    expect(skip).toBeEnabled()
    fireEvent.click(skip)
    await waitFor(() => {
      expect(screen.getByText('B', { selector: 'p' })).toBeInTheDocument()
    })
  })

  it('keeps lyric startAt after a signed URL refresh', async () => {
    const currentTimeDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime')
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
      configurable: true,
      get(this: HTMLMediaElement) {
        return Number(this.getAttribute('data-current-time') ?? 0)
      },
      set(this: HTMLMediaElement, value: number) {
        this.setAttribute('data-current-time', String(value))
      },
    })
    vi.mocked(fetchDownloadUrl).mockResolvedValue({
      data: { downloadUrl: 'https://cdn.example.com/fresh-lyric.mp3' },
    })

    try {
      const { unmount } = render(
        <AudioPlayerProvider>
          <LyricsHarness expired />
        </AudioPlayerProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: '歌詞シーク' }))
      await waitFor(() => {
        expect(screen.getByText('Lyric', { selector: 'p' })).toBeInTheDocument()
      })
      expect(document.querySelector('audio')?.currentTime).toBe(12)
      unmount()

      render(
        <AudioPlayerProvider>
          <LyricsHarness expired useStartAt />
        </AudioPlayerProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: '歌詞シーク' }))
      await waitFor(() => {
        expect(screen.getByText('Lyric', { selector: 'p' })).toBeInTheDocument()
      })
      expect(document.querySelector('audio')?.currentTime).toBe(12)
    } finally {
      if (currentTimeDesc) {
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', currentTimeDesc)
      }
    }
  })

  it('does not let a stale signed-URL refresh replace a later fresh track', async () => {
    let resolveExpired: ((value: { data: { downloadUrl: string } }) => void) | undefined
    vi.mocked(fetchDownloadUrl).mockImplementation(
      () => new Promise((resolve) => {
        resolveExpired = resolve
      }),
    )

    render(
      <AudioPlayerProvider>
        <RaceHarness />
      </AudioPlayerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '期限切れを再生' }))
    fireEvent.click(screen.getByRole('button', { name: '新しい曲を再生' }))
    expect(screen.getByText('Fresh', { selector: 'p' })).toBeInTheDocument()

    resolveExpired?.({ data: { downloadUrl: 'https://cdn.example.com/too-late.mp3' } })
    await Promise.resolve()
    expect(screen.getByText('Fresh', { selector: 'p' })).toBeInTheDocument()
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(
      'https://cdn.example.com/fresh-local.mp3',
    )
  })
})
