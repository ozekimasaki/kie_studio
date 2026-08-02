export type StudioWorkspaceMode = 'studio' | 'agent'

export function StudioModeToggle({
  value,
  onChange,
}: {
  value: StudioWorkspaceMode
  onChange: (mode: StudioWorkspaceMode) => void
}) {
  return (
    <div
      className="studio-segment shrink-0"
      role="tablist"
      aria-label="ワークスペースモード"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'studio'}
        className="studio-segment-item min-h-9 px-3 sm:px-4"
        onClick={() => onChange('studio')}
      >
        Studio
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'agent'}
        className="studio-segment-item min-h-9 px-3 sm:px-4"
        onClick={() => onChange('agent')}
      >
        エージェント
      </button>
    </div>
  )
}
