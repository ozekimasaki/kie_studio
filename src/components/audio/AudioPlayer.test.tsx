import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

type DownloadResult = { data: { downloadUrl: string } }

function TrackButtons() {
  const player = useAudioPlayer()
  const expired = expiredUrl('late')
  return (
    <>
      <button
        type="button"
        onClick={() => player.play({ kind: 'audio', url: expired, title: 'Expired' })}
      >
        期限切れを再生
      </button>
      <button
        type="button"
        onClick={() => player.play({
          kind: 'audio',
          url: 'https://cdn.example.com/fresh.mp3',
          title: 'Fresh',
        })}
      >
        新しい曲を再生
      </button>
    </>
  )
}

function LyricSeekHarness() {
  const player = useAudioPlayer()
  const expired = expiredUrl('song')
  return (
    <button
      type="button"
      onClick={() => {
        player.play({ kind: 'audio', url: expired, title: 'Song' })
        player.seek(12.5)
      }}
    >
      歌詞から再生
    </button>
  )
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

  it('ignores a signed-url refresh after a newer track has started', async () => {
    const late = deferred<DownloadResult>()
    vi.mocked(fetchDownloadUrl).mockImplementation(() => late.promise)

    render(
      <AudioPlayerProvider>
        <TrackButtons />
      </AudioPlayerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '期限切れを再生' }))
    fireEvent.click(screen.getByRole('button', { name: '新しい曲を再生' }))
    expect(screen.getByText('Fresh', { selector: 'p' })).toBeInTheDocument()
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(
      'https://cdn.example.com/fresh.mp3',
    )

    await act(async () => {
      late.resolve({ data: { downloadUrl: 'https://cdn.example.com/late.mp3' } })
      await late.promise
    })
    expect(screen.getByText('Fresh', { selector: 'p' })).toBeInTheDocument()
    expect(screen.queryByText('Expired', { selector: 'p' })).not.toBeInTheDocument()
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(
      'https://cdn.example.com/fresh.mp3',
    )
  })

  it('applies a lyric seek that arrives while a signed url is refreshing', async () => {
    const refreshes: Array<ReturnType<typeof deferred<DownloadResult>>> = []
    vi.mocked(fetchDownloadUrl).mockImplementation(() => {
      const next = deferred<DownloadResult>()
      refreshes.push(next)
      return next.promise
    })

    render(
      <AudioPlayerProvider>
        <LyricSeekHarness />
      </AudioPlayerProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '歌詞から再生' }))
    expect(refreshes).toHaveLength(1)
    refreshes[0]!.resolve({ data: { downloadUrl: 'https://cdn.example.com/fresh-1.mp3' } })
    await waitFor(() => {
      expect(document.querySelector('audio')?.getAttribute('src')).toBe(
        'https://cdn.example.com/fresh-1.mp3',
      )
    })
    expect(document.querySelector('audio')?.currentTime).toBe(12.5)

    fireEvent.click(screen.getByRole('button', { name: '歌詞から再生' }))
    expect(refreshes).toHaveLength(2)
    refreshes[1]!.resolve({ data: { downloadUrl: 'https://cdn.example.com/fresh-2.mp3' } })
    await waitFor(() => {
      expect(document.querySelector('audio')?.getAttribute('src')).toBe(
        'https://cdn.example.com/fresh-2.mp3',
      )
    })
    expect(document.querySelector('audio')?.currentTime).toBe(12.5)
  })
})
