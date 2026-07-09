import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  fetchGrokStatus,
  fetchOptimizeProfile,
  optimizePrompt,
} from '../lib/api.ts'

const inputClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] disabled:opacity-50'

export function PromptOptimizePanel({
  prompt,
  modelId,
  disabled,
  onApply,
}: {
  prompt: string
  modelId?: string | null
  disabled?: boolean
  onApply: (optimized: string) => void
}) {
  const [customInstructions, setCustomInstructions] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [appliedProfileLabel, setAppliedProfileLabel] = useState<string | null>(
    null,
  )

  const statusQuery = useQuery({
    queryKey: ['grok-status'],
    queryFn: fetchGrokStatus,
    staleTime: 60_000,
    retry: false,
  })

  const profileQuery = useQuery({
    queryKey: ['optimize-profile', modelId ?? null],
    queryFn: () => fetchOptimizeProfile(modelId),
    enabled: statusQuery.data?.data.available === true,
    staleTime: 60_000,
  })

  const optimize = useMutation({
    mutationFn: () =>
      optimizePrompt({
        prompt,
        customInstructions: customInstructions.trim() || undefined,
        modelId: modelId ?? undefined,
      }),
    onSuccess: (res) => {
      setPreview(res.data.optimizedPrompt)
      setAppliedProfileLabel(res.data.profile?.label ?? null)
    },
  })

  const available = statusQuery.data?.data.available === true
  if (statusQuery.isLoading || statusQuery.isError || !available) {
    return null
  }

  const promptEmpty = !prompt.trim()
  const optimizing = optimize.isPending
  const canOptimize = !optimizing && !disabled && !promptEmpty
  const profile = profileQuery.data?.data

  return (
    <div className="mt-3 space-y-2">
      {profile && (
        <p className="text-[11px] text-[var(--text-muted)]">
          最適化ルール:{' '}
          <span className="font-medium text-[var(--text)]">{profile.label}</span>
          {profile.hasGuide ? ' · 専用ガイドあり' : ''}
          <span className="mt-0.5 block truncate" title={profile.formula}>
            {profile.formula}
          </span>
        </p>
      )}

      <div>
        <label
          htmlFor="prompt-optimize-custom"
          className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]"
        >
          カスタム指示（任意）
        </label>
        <textarea
          id="prompt-optimize-custom"
          className={`${inputClass} min-h-16 resize-y text-xs`}
          value={customInstructions}
          disabled={optimizing || disabled}
          placeholder="例: 英語で出力 / カメラは固定 / 6秒想定で簡潔に"
          onChange={(e) => setCustomInstructions(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canOptimize}
          onClick={() => {
            setPreview(null)
            setAppliedProfileLabel(null)
            optimize.reset()
            optimize.mutate()
          }}
        >
          {optimizing ? '最適化中…' : 'プロンプト最適化'}
        </button>
        {promptEmpty && (
          <span className="text-[11px] text-[var(--text-muted)]">
            プロンプトを入力してください
          </span>
        )}
      </div>

      {optimize.isError && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {optimize.error instanceof Error
            ? optimize.error.message
            : '最適化に失敗しました'}
        </p>
      )}

      {preview !== null && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            最適化プレビュー
            {appliedProfileLabel ? ` · ${appliedProfileLabel}` : ''}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {preview}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              disabled={optimizing || disabled}
              onClick={() => {
                onApply(preview)
                setPreview(null)
                setAppliedProfileLabel(null)
                optimize.reset()
              }}
            >
              適用
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--text-muted)] disabled:opacity-50"
              disabled={optimizing}
              onClick={() => {
                setPreview(null)
                setAppliedProfileLabel(null)
                optimize.reset()
              }}
            >
              破棄
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
