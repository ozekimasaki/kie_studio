import { Search, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ModelDefinition, Provider } from '../lib/models/types.ts'
import { Pressable } from './motion/Pressable.tsx'

const FAVORITES_KEY = 'kie-studio-model-favorites'
const RECENTS_KEY = 'kie-studio-model-recents'

function readIds(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : []
  } catch {
    return []
  }
}

export function ModelSelect({
  models,
  value,
  onChange,
  disabled,
}: {
  models: ModelDefinition[]
  value: string | null
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<'all' | Provider>('all')
  const [useCase, setUseCase] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() => readIds(FAVORITES_KEY))
  const [recents, setRecents] = useState<string[]>(() => readIds(RECENTS_KEY))

  useEffect(() => {
    if (!value) return
    setRecents((previous) => {
      const next = [value, ...previous.filter((id) => id !== value)].slice(0, 8)
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
      return next
    })
  }, [value])

  const providers = useMemo(
    () => [...new Set(models.map((model) => model.provider))],
    [models],
  )
  const useCases = useMemo(
    () => [...new Set(models.flatMap((model) => model.useCase ? [model.useCase] : []))],
    [models],
  )
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return models
      .filter((model) => provider === 'all' || model.provider === provider)
      .filter((model) => useCase === 'all' || model.useCase === useCase)
      .filter((model) => !favoritesOnly || favorites.includes(model.id))
      .filter((model) => {
        if (!needle) return true
        return [model.title, model.model, model.provider, model.useCase, ...(model.tags ?? [])]
          .filter(Boolean)
          .some((part) => String(part).toLowerCase().includes(needle))
      })
      .toSorted((a, b) => {
        const favorite = Number(favorites.includes(b.id)) - Number(favorites.includes(a.id))
        if (favorite !== 0) return favorite
        const aRecent = recents.indexOf(a.id)
        const bRecent = recents.indexOf(b.id)
        if (aRecent >= 0 || bRecent >= 0) {
          if (aRecent < 0) return 1
          if (bRecent < 0) return -1
          return aRecent - bRecent
        }
        return a.title.localeCompare(b.title, 'ja')
      })
  }, [favorites, favoritesOnly, models, provider, query, recents, useCase])

  const selected = models.find((model) => model.id === value)
  const selectedIsFavorite = selected ? favorites.includes(selected.id) : false
  const options = selected && !visible.some((model) => model.id === selected.id)
    ? [selected, ...visible]
    : visible

  function toggleFavorite(id: string) {
    setFavorites((previous) => {
      const next = previous.includes(id)
        ? previous.filter((entry) => entry !== id)
        : [id, ...previous]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="model-select" className="studio-label">
          やりたいこと / モデル
        </label>
        {selected && (
          <Pressable
            type="button"
            className={`model-favorite-button ${selectedIsFavorite ? 'is-active' : ''}`}
            onClick={() => toggleFavorite(selected.id)}
            aria-label={selectedIsFavorite ? 'お気に入りから外す' : 'お気に入りに追加'}
            aria-pressed={selectedIsFavorite}
            disabled={disabled}
          >
            <Star size={16} fill={selectedIsFavorite ? 'currentColor' : 'none'} aria-hidden />
            <span>{selectedIsFavorite ? 'お気に入り済み' : 'お気に入りに追加'}</span>
          </Pressable>
        )}
      </div>

      {useCases.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="用途で絞り込み">
          {['all', ...useCases].map((entry) => (
            <button
              key={entry}
              type="button"
              className={`studio-chip ${useCase === entry ? 'is-active' : ''}`}
              onClick={() => setUseCase(entry)}
              disabled={disabled}
            >
              {entry === 'all' ? 'すべて' : entry}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]" />
          <span className="sr-only">モデルを検索</span>
          <input
            className="studio-input w-full py-2 pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="名前・用途・提供元で検索"
            disabled={disabled}
          />
        </label>
        <button
          type="button"
          className={`studio-chip ${favoritesOnly ? 'is-active' : ''}`}
          onClick={() => setFavoritesOnly((current) => !current)}
          disabled={disabled}
        >
          お気に入り
        </button>
      </div>

      {providers.length > 1 && (
        <select
          className="studio-select w-full py-2"
          value={provider}
          onChange={(event) => setProvider(event.target.value as 'all' | Provider)}
          disabled={disabled}
          aria-label="提供元で絞り込み"
        >
          <option value="all">すべての提供元</option>
          {providers.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
      )}

      <select
        id="model-select"
        className="studio-select w-full py-2.5"
        value={value ?? ''}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.length === 0 && <option value="">該当するモデルなし</option>}
        {options.map((model) => (
          <option key={model.id} value={model.id}>
            {favorites.includes(model.id) ? '★ ' : ''}{model.title} · {model.provider}
          </option>
        ))}
      </select>
      {selected && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <span className="truncate font-mono">{selected.model}</span>
          <span className="shrink-0">{selected.useCase ?? selected.category}</span>
        </div>
      )}
    </div>
  )
}
