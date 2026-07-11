import { useQuery } from '@tanstack/react-query'
import { fetchCredits, fetchHealth } from '../lib/api.ts'

export function CreditBadge({
  lastUsed,
}: {
  lastUsed?: number | null
}) {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
  })

  const credits = useQuery({
    queryKey: ['credits'],
    queryFn: fetchCredits,
    enabled: health.data?.hasKey === true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  })

  if (health.isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-muted)]">
        クレジット読込中…
      </div>
    )
  }

  if (health.data && !health.data.hasKey) {
    return (
      <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
        API key 未設定
      </div>
    )
  }

  if (credits.isError) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-xs text-[var(--danger)]">
        <span>クレジット取得エラー</span>
        <button
          type="button"
          onClick={() => void credits.refetch()}
          className="rounded-md border border-[var(--danger)]/40 px-2 py-0.5 font-medium hover:bg-[var(--danger)]/10"
        >
          再試行
        </button>
      </div>
    )
  }

  const remaining = credits.isLoading
    ? null
    : (credits.data?.data.credits ?? null)

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-sm">
      <div className="min-w-[88px]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          残クレジット
        </div>
        <div className="text-lg font-bold leading-tight text-[var(--accent)]">
          {remaining === null ? '…' : remaining.toLocaleString()}
        </div>
      </div>
      <div className="w-px self-stretch bg-[var(--border)]" />
      <div className="min-w-[88px]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          直近の使用
        </div>
        <div className="text-lg font-bold leading-tight text-[var(--text)]">
          {typeof lastUsed === 'number' ? (
            <>
              <span className="text-[var(--danger)]">−</span>
              {lastUsed.toLocaleString()}
            </>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </div>
      </div>
    </div>
  )
}
