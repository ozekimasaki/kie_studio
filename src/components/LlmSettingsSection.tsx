import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import {
  deleteLlmApiKey,
  fetchLlmSettings,
  saveDefaultLlmModel,
  saveLlmApiKey,
  saveLlmCustomEndpoints,
  type CustomEndpointInput,
  type LlmProviderSettings,
} from '../lib/agentApi.ts'
import { Pressable } from './motion/Pressable.tsx'

function LlmKeyForm({
  provider,
  onSaved,
}: {
  provider: LlmProviderSettings
  onSaved: () => void
}) {
  const [key, setKey] = useState('')
  const mutation = useMutation({
    mutationFn: () => saveLlmApiKey(provider.id, key.trim()),
    onSuccess: () => {
      setKey('')
      onSaved()
    },
  })

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <KeyRound
          size={13}
          strokeWidth={2}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          className="studio-input w-full py-1.5 pr-3 pl-8 text-xs"
          placeholder={provider.hasKey ? '新しいキーで上書き…' : `${provider.label} の API キー`}
          value={key}
          disabled={mutation.isPending}
          onChange={(e) => setKey(e.target.value)}
          aria-label={`${provider.label} の API キー`}
        />
      </div>
      <Pressable
        type="button"
        disabled={!key.trim() || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="studio-btn-primary w-auto shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
        scaleTo={0.96}
      >
        {mutation.isPending ? '保存中…' : '保存'}
      </Pressable>
      {mutation.isError && (
        <p className="studio-field-error" role="alert">
          {(mutation.error as Error).message}
        </p>
      )}
    </div>
  )
}

function CustomEndpointsEditor({
  endpoints,
  onChanged,
}: {
  endpoints: CustomEndpointInput[]
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<CustomEndpointInput['kind']>('openai-compatible')
  const [baseUrl, setBaseUrl] = useState('')
  const [models, setModels] = useState('')
  const [apiKey, setApiKey] = useState('')

  const mutation = useMutation({
    mutationFn: (next: CustomEndpointInput[]) => saveLlmCustomEndpoints(next),
    onSuccess: onChanged,
  })

  function slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'endpoint'
    )
  }

  function handleAdd() {
    const entry: CustomEndpointInput = {
      id: slugify(label),
      label: label.trim(),
      kind,
      baseUrl: baseUrl.trim(),
      models: models
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean),
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    }
    if (!entry.label || !entry.baseUrl || entry.models.length === 0) return
    mutation.mutate([...endpoints, entry], {
      onSuccess: () => {
        setLabel('')
        setBaseUrl('')
        setModels('')
        setApiKey('')
        setOpen(false)
      },
    })
  }

  return (
    <div className="mt-3">
      {endpoints.length > 0 && (
        <ul className="grid gap-1.5">
          {endpoints.map((endpoint) => (
            <li
              key={endpoint.id}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
            >
              <span className="flex-1">
                <span className="block font-medium text-[var(--text)]">{endpoint.label}</span>
                <span className="block text-[var(--text-muted)]">
                  {endpoint.kind === 'openai-compatible' ? 'OpenAI 互換' : 'Claude 互換'}
                  {' · '}
                  {endpoint.baseUrl}
                </span>
              </span>
              <Pressable
                type="button"
                aria-label={`${endpoint.label} を削除`}
                className="studio-btn w-auto px-2 py-1 text-[var(--danger)]"
                scaleTo={0.96}
                disabled={mutation.isPending}
                onClick={() =>
                  mutation.mutate(endpoints.filter((e) => e.id !== endpoint.id))
                }
              >
                <Trash2 size={12} strokeWidth={2} aria-hidden />
              </Pressable>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <Pressable
          type="button"
          onClick={() => setOpen(true)}
          className="studio-btn mt-2 w-auto gap-1 px-3 text-xs"
          scaleTo={0.96}
        >
          <Plus size={13} strokeWidth={2} aria-hidden />
          互換エンドポイントを追加
        </Pressable>
      ) : (
        <div className="mt-2 grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <input
            className="studio-input w-full py-1.5 text-xs"
            placeholder="表示名 (例: 社内 LLM ゲートウェイ)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="エンドポイント表示名"
          />
          <select
            className="studio-select w-full py-1.5 text-xs"
            value={kind}
            onChange={(e) => setKind(e.target.value as CustomEndpointInput['kind'])}
            aria-label="API 互換種別"
          >
            <option value="openai-compatible">OpenAI 互換 API</option>
            <option value="anthropic-compatible">Claude 互換 API</option>
          </select>
          <input
            className="studio-input w-full py-1.5 text-xs"
            placeholder="ベース URL (例: https://llm.example.com/v1)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            aria-label="ベース URL"
          />
          <input
            className="studio-input w-full py-1.5 text-xs"
            placeholder="モデル ID (カンマ区切り。例: llama-3.3-70b, mixtral-8x22b)"
            value={models}
            onChange={(e) => setModels(e.target.value)}
            aria-label="モデル ID 一覧"
          />
          <input
            type="password"
            autoComplete="off"
            className="studio-input w-full py-1.5 text-xs"
            placeholder="API キー"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            aria-label="エンドポイントの API キー"
          />
          {mutation.isError && (
            <p className="studio-field-error" role="alert">
              {(mutation.error as Error).message}
            </p>
          )}
          <div className="flex gap-2">
            <Pressable
              type="button"
              disabled={!label.trim() || !baseUrl.trim() || !models.trim() || mutation.isPending}
              onClick={handleAdd}
              className="studio-btn-primary w-auto flex-1 px-3 py-1.5 text-xs disabled:opacity-50"
              scaleTo={0.96}
            >
              {mutation.isPending ? '追加中…' : '追加'}
            </Pressable>
            <Pressable
              type="button"
              onClick={() => setOpen(false)}
              className="studio-btn w-auto px-3 py-1.5 text-xs"
              scaleTo={0.96}
            >
              キャンセル
            </Pressable>
          </div>
        </div>
      )}
    </div>
  )
}

function DefaultModelSelect({ onSaved }: { onSaved: () => void }) {
  const settingsQuery = useQuery({ queryKey: ['llm-settings'], queryFn: fetchLlmSettings })
  const mutation = useMutation({
    mutationFn: saveDefaultLlmModel,
    onSuccess: onSaved,
  })
  const settings = settingsQuery.data
  if (!settings) return null

  const choices = [
    ...settings.providers
      .filter((p) => p.hasKey)
      .flatMap((p) => p.suggestedModels.map((model) => ({ provider: p.id, model, label: `${p.label} / ${model}` }))),
    ...settings.customEndpoints
      .filter((e) => e.hasKey)
      .flatMap((e) => e.models.map((model) => ({ provider: `custom-${e.id}`, model, label: `${e.label} / ${model}` }))),
  ]
  if (choices.length === 0) return null

  const current = settings.defaultModel
  return (
    <div className="mt-4">
      <label htmlFor="llm-default-model" className="studio-label">
        既定モデル
      </label>
      <div className="mt-2 flex items-center gap-2">
        <select
          id="llm-default-model"
          className="studio-select w-full py-1.5 text-xs"
          value={current ? `${current.provider}::${current.model}` : ''}
          onChange={(e) => {
            const [provider, model] = e.target.value.split('::')
            if (provider && model) mutation.mutate({ provider, model })
          }}
        >
          <option value="" disabled>
            選択してください
          </option>
          {choices.map((choice) => (
            <option key={`${choice.provider}::${choice.model}`} value={`${choice.provider}::${choice.model}`}>
              {choice.label}
            </option>
          ))}
        </select>
        {mutation.isSuccess && (
          <Check size={14} className="shrink-0 text-[var(--success)]" aria-hidden />
        )}
      </div>
      <p className="mt-1 text-[10px] text-[var(--text-muted)]">
        新しい会話の初期モデルです。会話ごとに変更できます。
      </p>
    </div>
  )
}

export function LlmSettingsSection() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: ['llm-settings'], queryFn: fetchLlmSettings })

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['llm-settings'] })
  }

  const settings = settingsQuery.data

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-4">
      <div className="studio-label">エージェント (LLM プロバイダ)</div>
      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
        エージェントモードで使う LLM の API キーを管理します。キーはこの端末内にのみ暗号化して保存され、エージェントサーバー以外には公開されません。
      </p>

      {settingsQuery.isLoading ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">読込中…</p>
      ) : settingsQuery.isError ? (
        <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
          {(settingsQuery.error as Error).message}
        </p>
      ) : (
        <div className="mt-3 grid gap-4">
          {settings?.providers.map((provider) => (
            <div key={provider.id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-[var(--text)]">{provider.label}</span>
                {provider.hasKey ? (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                    <ShieldCheck size={12} strokeWidth={2} aria-hidden />
                    {provider.apiKeyMasked}
                    {!provider.apiKeyFromStore && '（環境変数から）'}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">未設定</span>
                )}
                {provider.hasKey && provider.apiKeyFromStore && (
                  <DeleteKeyButton provider={provider.id} onDeleted={refresh} />
                )}
              </div>
              <LlmKeyForm provider={provider} onSaved={refresh} />
            </div>
          ))}

          <div>
            <div className="studio-label">カスタムエンドポイント (OpenAI / Claude 互換)</div>
            <CustomEndpointsEditor
              endpoints={
                settings?.customEndpoints.map((e) => ({
                  id: e.id,
                  label: e.label,
                  kind: e.kind,
                  baseUrl: e.baseUrl,
                  models: e.models,
                })) ?? []
              }
              onChanged={refresh}
            />
          </div>

          <DefaultModelSelect onSaved={refresh} />
        </div>
      )}
    </section>
  )
}

function DeleteKeyButton({
  provider,
  onDeleted,
}: {
  provider: string
  onDeleted: () => void
}) {
  const mutation = useMutation({
    mutationFn: () => deleteLlmApiKey(provider),
    onSuccess: onDeleted,
  })
  return (
    <Pressable
      type="button"
      aria-label="保存したキーを削除"
      className="studio-btn w-auto px-2 py-0.5 text-[10px] text-[var(--danger)]"
      scaleTo={0.96}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      <Trash2 size={11} strokeWidth={2} aria-hidden />
    </Pressable>
  )
}