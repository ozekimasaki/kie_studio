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
})
