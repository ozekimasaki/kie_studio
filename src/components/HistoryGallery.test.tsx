import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryGallery } from './HistoryGallery.tsx'
import { AudioPlayerProvider } from './audio/AudioPlayer.tsx'
import type { HistoryItem } from '../lib/models/types.ts'

function imageItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    taskId: 'task-1',
    model: 'market/flux',
    category: 'image',
    state: 'success',
    createdAt: Date.now(),
    prompt: 'a red fox',
    resultUrls: ['https://cdn.example.com/fox.png'],
    media: [{ kind: 'image', url: 'https://cdn.example.com/fox.png' }],
    ...overrides,
  }
}

function renderGallery(
  items: HistoryItem[],
  overrides: Partial<Parameters<typeof HistoryGallery>[0]> = {},
) {
  const handlers = {
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onRemove: vi.fn(),
    onClear: vi.fn(),
    onReuse: vi.fn(),
    onRetry: vi.fn(),
    onSendToInput: vi.fn(),
    onTogglePin: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onUpdateItem: vi.fn(),
    onQuickAction: vi.fn(),
  }
  render(
    <AudioPlayerProvider>
      <HistoryGallery
        items={items}
        activeCategory="image"
        {...handlers}
        {...overrides}
      />
    </AudioPlayerProvider>,
  )
  return handlers
}

describe('HistoryGallery', () => {
  afterEach(cleanup)

  it('shows the empty state when there is no history', () => {
    renderGallery([])
    expect(screen.getByText('まだ何もありません')).toBeInTheDocument()
    expect(screen.getByText('まだ生成がありません')).toBeInTheDocument()
  })

  it('renders an item and selects it on click', () => {
    const { onSelect } = renderGallery([imageItem()])
    const tile = screen.getByAltText('a red fox').closest('button')
    expect(tile).not.toBeNull()
    fireEvent.click(tile as HTMLButtonElement)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'task-1' }),
    )
  })

  it('summarizes count with pending generations in the header', () => {
    renderGallery([imageItem()], { pendingCount: 2 })
    expect(screen.getByText('1 件 · 2 件生成中')).toBeInTheDocument()
  })

  it('exposes filter controls once history exists', () => {
    renderGallery([imageItem()])
    expect(
      screen.getByRole('combobox', { name: 'カテゴリで絞り込み' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('combobox', { name: '状態で絞り込み' }),
    ).toBeInTheDocument()
  })
})
