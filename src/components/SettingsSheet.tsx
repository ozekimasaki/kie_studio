import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  KeyRound,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { clearApiKey, fetchSettings, saveApiKey } from '../lib/api.ts'
import { Pressable } from './motion/Pressable.tsx'
import { SpringSheet } from './motion/SpringSheet.tsx'

const APP_VERSION =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev'

export function SettingsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await fetchSettings()).data,
    enabled: open,
    staleTime: 30_000,
  })

  // 入力欄はシートを開くたびに空へ戻す（キー実体は保持しない）。
  useEffect(() => {
    if (open) {
      setApiKey('')
      setSaved(false)
    }
  }, [open])

  async function refreshDependentQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['settings'] }),
      queryClient.invalidateQueries({ queryKey: ['health'] }),
      queryClient.invalidateQueries({ queryKey: ['credits'] }),
    ])
  }

  const save = useMutation({
    mutationFn: (key: string) => saveApiKey(key),
    onSuccess: async () => {
      setApiKey('')
      setSaved(true)
      await refreshDependentQueries()
    },
  })

  const remove = useMutation({
    mutationFn: () => clearApiKey(),
    onSuccess: async () => {
      setSaved(false)
      await refreshDependentQueries()
    },
  })

  const trimmed = apiKey.trim()
  const canSave = trimmed.length > 0 && !save.isPending
  const settings = settingsQuery.data
  const mutationError =
    save.error instanceof Error
      ? save.error.message
      : remove.error instanceof Error
        ? remove.error.message
        : null

  return (
    <SpringSheet
      open={open}
      onClose={onClose}
      labelledBy="settings-title"
      maxWidthClass="max-w-lg"
    >
      <div className="overflow-y-auto px-5 pt-4 pb-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)]/10 text-[var(--accent)]">
            <Settings size={20} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2 id="settings-title" className="text-lg font-bold">
              設定
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
              KIE API キーを保存すると、以降の生成に使用されます。キーはこの端末内（アプリのデータ領域）にのみ保存されます。
            </p>
          </div>
        </div>

        <section className="mt-5">
          <label htmlFor="settings-api-key" className="studio-label">
            KIE API キー
          </label>

          {settingsQuery.isLoading ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              設定を読込中…
            </p>
          ) : (
            <>
              {settings?.hasApiKey ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--success,var(--accent))]/25 bg-[var(--accent)]/8 px-3 py-2 text-xs">
                  <ShieldCheck
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                    className="text-[var(--accent)]"
                  />
                  <span className="font-medium text-[var(--text)]">
                    保存済み
                  </span>
                  {settings.apiKeyMasked && (
                    <span className="font-mono tabular-nums text-[var(--text-muted)]">
                      {settings.apiKeyMasked}
                    </span>
                  )}
                  {!settings.apiKeyFromStore && (
                    <span className="text-[var(--text-muted)]">
                      （環境変数から）
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--warning)]">
                  未設定です。キーを保存すると生成できるようになります。
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound
                    size={14}
                    strokeWidth={2}
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    id="settings-api-key"
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    data-sheet-initial-focus="true"
                    className="studio-input w-full py-2 pr-3 pl-9"
                    placeholder={
                      settings?.hasApiKey
                        ? '新しいキーで上書き…'
                        : 'sk-... を貼り付け'
                    }
                    value={apiKey}
                    disabled={save.isPending}
                    onChange={(event) => {
                      setApiKey(event.target.value)
                      setSaved(false)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && canSave) {
                        save.mutate(trimmed)
                      }
                    }}
                  />
                </div>
                <Pressable
                  disabled={!canSave}
                  onClick={() => save.mutate(trimmed)}
                  className="studio-btn-primary w-auto shrink-0 gap-1 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  scaleTo={0.96}
                  aria-busy={save.isPending || undefined}
                >
                  {saved ? (
                    <>
                      <Check size={14} strokeWidth={2} aria-hidden />
                      保存済み
                    </>
                  ) : save.isPending ? (
                    '保存中…'
                  ) : (
                    '保存'
                  )}
                </Pressable>
              </div>

              {settings?.hasApiKey && settings.apiKeyFromStore && (
                <Pressable
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                  className="studio-btn mt-2 w-auto gap-1 px-3 text-xs text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
                  scaleTo={0.96}
                >
                  <Trash2 size={13} strokeWidth={2} aria-hidden />
                  {remove.isPending ? '削除中…' : '保存したキーを削除'}
                </Pressable>
              )}

              {mutationError && (
                <p className="studio-field-error mt-2" role="alert">
                  {mutationError}
                </p>
              )}
            </>
          )}
        </section>

        <section className="mt-6 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="studio-label">アプリ情報</div>
              <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
                KIE STUDIO{' '}
                <span className="text-[var(--text-muted)]">v{APP_VERSION}</span>
              </p>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="studio-btn w-auto gap-1 px-3 text-xs"
              aria-label="アップデートを確認"
            >
              <RefreshCw size={13} strokeWidth={2} aria-hidden />
              アップデートを確認
            </a>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
            デスクトップ版は起動時に自動でアップデートを確認します。新しい版がある場合は次回起動時に適用されます。
          </p>
        </section>

        <div className="mt-5 flex justify-end">
          <Pressable onClick={onClose} className="studio-btn" scaleTo={0.96}>
            閉じる
          </Pressable>
        </div>
      </div>
    </SpringSheet>
  )
}
