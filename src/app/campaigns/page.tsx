'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Trash2, Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const STEPS = ['setup', 'analysis', 'opportunities', 'outreach', 'production', 'client-view']
const STAGE_TO_STEP: Record<string, string> = {
  draft: 'setup', setup: 'setup',
  discovery: 'analysis', analysis: 'analysis',
  scoring: 'outreach', scored: 'outreach', review: 'outreach',
  engage: 'outreach', opportunities: 'outreach', outreach: 'outreach',
  production: 'production',
  'client-view': 'client-view', live: 'client-view',
}
function campaignTab(stage: unknown): string {
  const step = STAGE_TO_STEP[String(stage)] ?? 'setup'
  const idx = STEPS.indexOf(step)
  return STEPS[Math.max(0, idx - 1)] || step
}

const AVATAR_PALETTES = [
  { bg: 'rgba(237,126,8,0.18)',  text: '#ed7e08' },
  { bg: 'rgba(99,102,241,0.18)', text: '#818cf8' },
  { bg: 'rgba(34,197,94,0.18)',  text: '#4ade80' },
  { bg: 'rgba(236,72,153,0.18)', text: '#f472b6' },
  { bg: 'rgba(14,165,233,0.18)', text: '#38bdf8' },
  { bg: 'rgba(168,85,247,0.18)', text: '#c084fc' },
]
function avatarPalette(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length]
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const { addToast } = useToast()

  const load = () => {
    setLoading(true)
    setError('')
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setCampaigns(Array.isArray(d) ? d : [])
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/campaigns/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== deleteTarget.id))
        addToast('success', `Deleted "${deleteTarget.name}"`)
      } else {
        addToast('error', data.error || 'Failed to delete campaign')
      }
    } catch (e) {
      addToast('error', (e as Error).message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const activeCount = campaigns.filter(c => c.status === 'active').length

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
          <span style={{ color: 'var(--accent)' }}>—</span> Workspace
        </div>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>Campaigns</h1>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
              {activeCount} active campaign{activeCount !== 1 ? 's' : ''}
              {campaigns.length > activeCount ? ` · ${campaigns.length - activeCount} draft` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Column headers */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-[1fr_100px_90px_90px_32px] gap-4 px-4 mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Client</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Status</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Experts</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Last run</div>
          <div />
        </div>
      )}

      {/* States */}
      {loading && (
        <div className="flex items-center gap-2 py-12 justify-center text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl text-[13px]" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {error} — <button onClick={load} className="underline">retry</button>
        </div>
      )}

      {!loading && !error && campaigns.length === 0 && (
        <EmptyState
          icon=""
          title="No campaigns yet"
          description="Create your first campaign to get started."
          action={{ label: 'New campaign', onClick: () => router.push('/campaigns/new') }}
        />
      )}

      {/* Campaign rows */}
      {!loading && !error && campaigns.length > 0 && (
        <div className="space-y-2">
          {campaigns.map(c => {
            const clientName = String(c.client_name || '')
            const palette = avatarPalette(clientName)
            const initial = clientName.charAt(0).toUpperCase()
            const expertCount = Number(c.expert_count || 0)
            const lastRunAt = c.last_run_at ? relativeTime(String(c.last_run_at)) : null
            const isActive = c.status === 'active'
            const href = `/campaigns/${c.id}/${campaignTab(c.stage)}`

            return (
              <div
                key={String(c.id)}
                onClick={() => router.push(href)}
                className="group grid grid-cols-[1fr_100px_90px_90px_32px] gap-4 items-center px-4 py-4 rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                {/* Client + campaign name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-[15px] font-bold shrink-0"
                    style={{ background: palette.bg, color: palette.text }}
                  >
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {String(c.name)}
                    </div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {clientName}
                      {c.owner_name ? ` · ${String(c.owner_name)}` : ''}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={isActive
                      ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80' }
                      : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }
                    }
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: isActive ? '#4ade80' : 'var(--text-muted)' }} />
                    {isActive ? 'Live' : 'Draft'}
                  </span>
                </div>

                {/* Experts */}
                <div className="text-[13px] font-semibold" style={{ color: expertCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {expertCount > 0 ? `${expertCount} experts` : '—'}
                </div>

                {/* Last run */}
                <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  {lastRunAt ?? '—'}
                </div>

                {/* Chevron + delete */}
                <div className="flex items-center justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                    style={{ color: 'var(--text-muted)' }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete modal */}
      <Modal open={deleteTarget !== null} onClose={() => !deleting && setDeleteTarget(null)} title="Delete Campaign" size="sm">
        {deleteTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[13px] font-medium" style={{ color: '#f87171' }}>This cannot be undone.</p>
            </div>
            <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
              Delete <strong style={{ color: 'var(--text-primary)' }}>{String(deleteTarget.name)}</strong>? All evaluations, scores, and activity history will be removed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="btn-ghost text-[13px]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="h-8 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: '#dc2626' }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
