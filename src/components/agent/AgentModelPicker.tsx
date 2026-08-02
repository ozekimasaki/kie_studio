import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import {
  fetchLlmSettings,
  type CustomEndpointSettings,
  type LlmProviderSettings,
} from '../../lib/agentApi.ts'
import { customEndpointProviderId } from '../../lib/models/llmProviders.ts'

export interface ModelSelection {
  provider: string
  model: string
}

interface ProviderOption {
  provider: string
  label: string
  detail: string
  models: string[]
  configured: boolean
}

function toOption(p: LlmProviderSettings): ProviderOption {
  return {
    provider: p.id,
    label: p.label,
    detail: p.hasKey ? (p.apiKeyMasked ?? '') : 'キー未設定',
    models: p.suggestedModels,
    configured: p.hasKey,
  }
}

function endpointToOption(e: CustomEndpointSettings): ProviderOption {
  return {
    provider: customEndpointProviderId(e.id),
    label: e.label,
    detail: `${e.kind === 'openai-compatible' ? 'OpenAI 互換' : 'Claude 互換'} · ${e.hasKey ? '設定済み' : 'キー未設定'}`,
    models: e.models,
    configured: e.hasKey,
  }
}

export function AgentModelPicker({
  value,
  onChange,
}: {
  value: ModelSelection | null
  onChange: (selection: ModelSelection) => void
}) {
  const settingsQuery = useQuery({ queryKey: ['llm-settings'], queryFn: fetchLlmSettings })
  const [customModel, setCustomModel] = useState('')

  const options = useMemo<ProviderOption[]>(() => {
    const data = settingsQuery.data
    if (!data) return []
    return [
      ...data.providers.map(toOption),
      ...data.customEndpoints.map(endpointToOption),
    ]
  }, [settingsQuery.data])

  const selected = options.find((o) => o.provider === value?.provider) ?? null

  if (settingsQuery.isLoading) {
    return <p className="text-sm text-[var(--text-muted)]">LLM 設定を読込中…</p>
  }
  if (settingsQuery.isError) {
    return (
      <p className="text-sm text-[var(--danger)]" role="alert">
        {(settingsQuery.error as Error).message}
      </p>
    )
  }

  const configured = options.filter((o) => o.configured)

  return (
    <div className="grid gap-3">
      {configured.length === 0 && (
        <p className="rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--surface)] p-3 text-sm text-[var(--text-muted)]">
          利用可能な LLM プロバイダがありません。設定画面で API キーを登録してください。
        </p>
      )}

      <div className="grid gap-1.5" role="radiogroup" aria-label="LLM プロバイダ">
        {options.map((option) => {
          const active = selected?.provider === option.provider
          return (
            <button
              key={option.provider}
              type="button"
              disabled={!option.configured}
              onClick={() => {
                const model = option.models[0] ?? ''
                onChange({ provider: option.provider, model })
                setCustomModel('')
              }}
              className={`flex items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? 'border-[var(--accent)] bg-[var(--surface-raised)]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              } disabled:opacity-45`}
              role="radio"
              aria-checked={active}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border)]">
                {active && <Check size={12} className="text-[var(--accent)]" aria-hidden />}
              </span>
              <span className="flex-1">
                <span className="block font-medium text-[var(--text)]">{option.label}</span>
                <span className="block text-xs text-[var(--text-muted)]">{option.detail}</span>
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="grid gap-2">
          <label className="studio-label" htmlFor="agent-model-select">
            モデル
          </label>
          <select
            id="agent-model-select"
            className="studio-select w-full"
            value={
              value && selected.models.includes(value.model)
                ? value.model
                : customModel
                  ? '__custom__'
                  : (value?.model ?? '')
            }
            onChange={(e) => {
              if (e.target.value === '__custom__') return
              onChange({ provider: selected.provider, model: e.target.value })
              setCustomModel('')
            }}
          >
            {selected.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
            {customModel && <option value="__custom__">{customModel} (手入力)</option>}
          </select>
          <input
            type="text"
            className="studio-input w-full"
            placeholder="またはモデル ID を直接入力"
            value={customModel}
            onChange={(e) => {
              setCustomModel(e.target.value)
              if (e.target.value.trim()) {
                onChange({ provider: selected.provider, model: e.target.value.trim() })
              }
            }}
            aria-label="モデル ID を直接入力"
          />
        </div>
      )}
    </div>
  )
}