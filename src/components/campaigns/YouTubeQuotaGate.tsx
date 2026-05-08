'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface QuotaStatus {
  severity: 'ok' | 'degraded' | 'blocked'
  primary_ok: boolean
  backup_ok: boolean
  has_backup: boolean
}

/**
 * Gate a campaign launch on YouTube quota status. If both keys are out we
 * still let users continue (Medium/Dev.to discovery still works) but warn
 * loudly. Returns a render-prop modal + an async `check()` that resolves
 * `true` when the caller should proceed with the launch.
 */
export function useYouTubeQuotaGate() {
  const [status, setStatus] = useState<QuotaStatus | null>(null)
  const [resolver, setResolver] = useState<((proceed: boolean) => void) | null>(null)
  const [checking, setChecking] = useState(false)

  const check = useCallback(async (): Promise<boolean> => {
    setChecking(true)
    try {
      const res = await fetch('/api/youtube/quota-status', { cache: 'no-store' })
      if (!res.ok) return true // probe failed — don't block the user, fail open
      const data = (await res.json()) as QuotaStatus
      if (data.severity === 'ok') return true
      // Show modal and wait for user decision
      return new Promise<boolean>(resolve => {
        setStatus(data)
        setResolver(() => resolve)
      })
    } catch {
      return true
    } finally {
      setChecking(false)
    }
  }, [])

  const modal = (
    <Modal
      open={!!status && !!resolver}
      onClose={() => { resolver?.(false); setResolver(null); setStatus(null) }}
      title="YouTube API quota issue"
    >
      {status && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-900/20 border border-amber-700/40">
            <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-200 space-y-2">
              {status.severity === 'degraded' ? (
                <>
                  <p className="font-medium">Primary YouTube API key is rate-limited.</p>
                  <p className="text-slate-400">
                    A backup key is available and will be used. YouTube creator discovery should still work,
                    but throughput may be reduced. Quotas reset at midnight Pacific.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">All YouTube API keys are exhausted.</p>
                  <p className="text-slate-400">
                    YouTube creator discovery will be skipped for this run — only Medium and Dev.to creators
                    will surface. Quotas reset at midnight Pacific. You can still launch the campaign.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <div>Primary key: {status.primary_ok ? '✓ healthy' : '✗ unavailable'}</div>
            {status.has_backup && (
              <div>Backup key: {status.backup_ok ? '✓ healthy' : '✗ unavailable'}</div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { resolver?.(false); setResolver(null); setStatus(null) }}
              className="px-3 py-1.5 text-sm rounded-md border border-[#2d3748] text-slate-300 hover:bg-[#263044]"
            >
              Cancel
            </button>
            <button
              onClick={() => { resolver?.(true); setResolver(null); setStatus(null) }}
              className="px-3 py-1.5 text-sm rounded-md bg-orange-500 text-black font-medium hover:bg-orange-400"
            >
              Run anyway
            </button>
          </div>
        </div>
      )}
    </Modal>
  )

  return { check, modal, checking }
}
