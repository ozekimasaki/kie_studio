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
  const [previewMode, setPreviewMode] = useState<'generate' | 'optimize' | null>(
    null,
  )
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

  const promptEmpty = !prompt.trim()
  const mode: 'generate' | 'optimize' = promptEmpty ? 'generate' : 'optimize'
  const customEmpty = !customInstructions.trim()

  const assist = useMutation({
    mutationFn: () =>
      optimizePrompt({
        prompt: promptEmpty ? undefined : prompt,
        customInstructions: customInstructions.trim() || undefined,
        modelId: modelId ?? undefined,
        mode,
      }),
    onSuccess: (res) => {
      setPreview(res.data.optimizedPrompt)
      setPreviewMode(res.data.mode ?? mode)
      setAppliedProfileLabel(res.data.profile?.label ?? null)
    },
  })

  const available = statusQuery.data?.data.available === true
  if (statusQuery.isLoading || statusQuery.isError || !available) {
    return null
  }

  const busy = assist.isPending
  const canRun =
    !busy &&
    !disabled &&
    (mode === 'optimize' ? !promptEmpty : !customEmpty)
  const profile = profileQuery.data?.data

  const buttonLabel = busy
    ? mode === 'generate'
      ? '生成中…'
      : '最適化中…'
    : mode === 'generate'
      ? 'プロンプトを生成'
      : 'プロンプトを最適化'

  const hint =
    mode === 'generate' && customEmpty
      ? 'やりたいことをカスタム指示に書いてください'
      : null

  return (
    <div className="mt-3 space-y-2">
      {profile && (
        <p className="text-[11px] text-[var(--text-muted)]">
          {mode === 'generate' ? '生成ルール' : '最適化ルール'}:{' '}
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
          {mode === 'generate'
            ? 'やりたいこと・メモ'
            : 'カスタム指示（任意）'}
          {mode === 'generate' && (
            <span className="ml-1 text-[var(--danger)]">*</span>
          )}
        </label>
        <textarea
          id="prompt-optimize-custom"
          className={`${inputClass} min-h-16 resize-y text-xs`}
          value={customInstructions}
          disabled={busy || disabled}
          placeholder={
            mode === 'generate'
              ? '例: 夕暮れの海岸を歩く女性、シネマ風、6秒'
              : '例: 英語で出力 / カメラは固定 / もっと短く'
          }
          onChange={(e) => setCustomInstructions(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canRun}
          onClick={() => {
            setPreview(null)
            setPreviewMode(null)
            setAppliedProfileLabel(null)
            assist.reset()
            assist.mutate()
          }}
        >
          {buttonLabel}
        </button>
        {hint && (
          <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
        )}
      </div>

      {assist.isError && (
        <p className="text-xs text-[var(--danger)]" role="alert">
          {assist.error instanceof Error
            ? assist.error.message
            : mode === 'generate'
              ? '生成に失敗しました'
              : '最適化に失敗しました'}
        </p>
      )}

      {preview !== null && (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            {previewMode === 'generate' ? '生成プレビュー' : '最適化プレビュー'}
            {appliedProfileLabel ? ` · ${appliedProfileLabel}` : ''}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">
            {preview}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              disabled={busy || disabled}
              onClick={() => {
                onApply(preview)
                setPreview(null)
                setPreviewMode(null)
                setAppliedProfileLabel(null)
                assist.reset()
              }}
            >
              適用
            </button>
            <button
              type="button"
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--text-muted)] disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setPreview(null)
                setPreviewMode(null)
                setAppliedProfileLabel(null)
                assist.reset()
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
