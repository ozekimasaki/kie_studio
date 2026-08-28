import type { AgentRunMode } from '../../lib/agentRunMode.ts'

export function AgentRunModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: AgentRunMode
  onChange: (mode: AgentRunMode) => void
  disabled?: boolean
}) {
  return (
    <div
      className="studio-segment w-full shrink-0 sm:w-auto"
      role="tablist"
      aria-label="エージェント実行モード"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'plan'}
        disabled={disabled}
        className="studio-segment-item min-h-8 flex-1 px-3 text-xs sm:flex-none"
        onClick={() => onChange('plan')}
      >
        プラン
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'agent'}
        disabled={disabled}
        className="studio-segment-item min-h-8 flex-1 px-3 text-xs sm:flex-none"
        onClick={() => onChange('agent')}
      >
        エージェント
      </button>
    </div>
  )
}
