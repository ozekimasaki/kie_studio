import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { fetchCredits, fetchHealth } from '../lib/api.ts'
import { Pressable } from './motion/Pressable.tsx'

const KIE_CREDITS_URL = 'https://kie.ai?ref=dd87d42d5f68654c2f773c290afc7b6e'

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
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-xs text-[var(--text-muted)]">
        クレジット読込中…
      </div>
    )
  }

  if (health.data && !health.data.hasKey) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
        API key 未設定
      </div>
    )
  }

  if (credits.isError) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/25 bg-[var(--danger)]/8 px-3 py-2 text-xs text-[var(--danger)]">
        <span>クレジット取得エラー</span>
        <Pressable
          onClick={() => void credits.refetch()}
          className="studio-btn border-[var(--danger)]/30 px-2.5 py-0.5 font-medium text-[var(--danger)]"
          scaleTo={0.96}
        >
          再試行
        </Pressable>
      </div>
    )
  }

  const remaining = credits.isLoading
    ? null
    : (credits.data?.data.credits ?? null)

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
      <div className="flex items-stretch gap-3">
        <div className="min-w-[72px]">
          <div className="studio-label">残クレジット</div>
          <div className="mt-0.5 text-lg font-bold leading-none tabular-nums text-[var(--accent)]">
            {remaining === null ? '…' : remaining.toLocaleString()}
          </div>
        </div>
        <div className="w-px self-stretch bg-[var(--border)]" />
        <div className="min-w-[72px]">
          <div className="studio-label">直近の使用</div>
          <div className="mt-0.5 text-lg font-bold leading-none tabular-nums text-[var(--text)]">
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
      {remaining !== null && remaining <= 0 && (
        <a
          href={KIE_CREDITS_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--danger)] underline underline-offset-2"
        >
          クレジット購入はこちら
          <ExternalLink size={12} strokeWidth={2} aria-hidden />
        </a>
      )}
    </div>
  )
}
