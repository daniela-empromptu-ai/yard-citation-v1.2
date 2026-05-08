'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Loader2, Send, Check, Copy, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { showToast } from '@/components/ui/Toaster'

interface Props {
  campaign: { id: string }
}

interface Packet {
  id: string
  campaign_creator_id: string
  subject: string
  body_md: string
  last_updated_at: string
  created_at: string
  outreach_state: string | null
  creator_name: string
  creator_platform: string
  overall_score: number | null
}

const SECTIONS: Array<{
  id: 'draft' | 'sent' | 'replied'
  label: string
  helper: string
  states: string[]
}> = [
  { id: 'draft', label: 'Response needed', helper: "You haven't sent yet. Review and approve or edit.", states: ['drafting', 'draft'] },
  { id: 'sent', label: 'Awaiting reply', helper: 'Sent. No response yet.', states: ['sent'] },
  { id: 'replied', label: 'Awaiting review', helper: 'They replied. Decide next step.', states: ['replied', 'booked', 'live', 'verified'] },
]

export default function OutreachTab({ campaign }: Props) {
  const { data: session } = useSession()
  const userId = (session?.user as { id?: string } | undefined)?.id || null
  const [packets, setPackets] = useState<Packet[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ subject: string; body_md: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/outreach-packets`, { cache: 'no-store' })
      const data = await res.json()
      setPackets(data.packets || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [campaign.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = SECTIONS.map(s => ({
    ...s,
    items: packets.filter(p => s.states.includes(p.outreach_state || 'draft')),
  }))

  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const onSend = async (p: Packet) => {
    if (!userId) { showToast('error', 'Not signed in'); return }
    setBusy(p.id)
    try {
      // Copy body to clipboard so the user can paste into their mail client
      try { await navigator.clipboard.writeText(`${p.subject}\n\n${p.body_md}`) } catch { /* ignore */ }
      const res = await fetch(`/api/outreach-packets/${p.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (res.ok) {
        showToast('success', 'Marked sent · email copied to clipboard')
        await load()
      } else {
        showToast('error', 'Failed to mark sent')
      }
    } finally {
      setBusy(null)
    }
  }

  const onSaveEdit = async (p: Packet) => {
    if (!editDraft) return
    setBusy(p.id)
    try {
      const res = await fetch(`/api/outreach-packets/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      if (res.ok) {
        setEditing(null); setEditDraft(null)
        await load()
        showToast('success', 'Draft updated')
      } else {
        showToast('error', 'Save failed')
      }
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading outreach queue…
      </div>
    )
  }

  if (packets.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="card p-8 text-center bg-[#1e293b] rounded-2xl border border-[#2d3748]">
          <FileText size={28} className="text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">No outreach drafts yet</h3>
          <p className="text-sm text-slate-400">
            Click the <span className="text-orange-400">+ Add</span> action on a creator card in Opportunities to queue a draft.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-8">
      {grouped.map(section => (
        <section key={section.id}>
          <header className="flex items-baseline gap-3 mb-3">
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
              section.id === 'draft' ? 'bg-amber-500/20 text-amber-300'
              : section.id === 'sent' ? 'bg-blue-500/20 text-blue-300'
              : 'bg-violet-500/20 text-violet-300'
            }`}>{section.id === 'draft' ? 'Draft' : section.id === 'sent' ? 'Sent' : 'Replied'}</span>
            <h3 className="text-base font-semibold text-slate-100">{section.label}</h3>
            <p className="text-xs text-slate-500 flex-1">{section.helper}</p>
            <span className="text-xs text-slate-500">{section.items.length} item{section.items.length === 1 ? '' : 's'}</span>
          </header>

          {section.items.length === 0 ? (
            <p className="text-xs text-slate-500 px-2">Nothing here.</p>
          ) : (
            <div className="space-y-3">
              {section.items.map(p => {
                const isExpanded = expanded.has(p.id)
                const isEditing = editing === p.id
                return (
                  <div key={p.id} className="card bg-[#1e293b] rounded-2xl border border-[#2d3748] overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <FileText size={16} className="text-slate-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-100 truncate">{p.creator_name}</p>
                        <p className="text-xs text-slate-400 truncate">{p.subject}</p>
                      </div>
                      {p.overall_score != null && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-semibold">{p.overall_score}</span>
                      )}
                      {section.id === 'draft' && (
                        <button
                          onClick={() => onSend(p)}
                          disabled={busy === p.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-orange-500 text-black font-medium hover:bg-orange-400 disabled:opacity-50"
                        >
                          {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                          Approve
                        </button>
                      )}
                      <button onClick={() => toggle(p.id)} className="p-1 text-slate-400 hover:text-slate-200">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#2d3748] p-4 space-y-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Draft · editable before send</p>
                        {isEditing ? (
                          <>
                            <input
                              value={editDraft?.subject || ''}
                              onChange={e => setEditDraft(d => ({ subject: e.target.value, body_md: d?.body_md || '' }))}
                              className="w-full px-3 py-2 rounded-md bg-[#0f172a] border border-[#2d3748] text-sm text-slate-100"
                            />
                            <textarea
                              value={editDraft?.body_md || ''}
                              onChange={e => setEditDraft(d => ({ subject: d?.subject || '', body_md: e.target.value }))}
                              rows={12}
                              className="w-full px-3 py-2 rounded-md bg-[#0f172a] border border-[#2d3748] text-sm text-slate-100 font-mono"
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => { setEditing(null); setEditDraft(null) }} className="px-3 py-1.5 text-xs rounded-md border border-[#2d3748] text-slate-300 hover:bg-[#263044]">Cancel</button>
                              <button onClick={() => onSaveEdit(p)} disabled={busy === p.id} className="px-3 py-1.5 text-xs rounded-md bg-orange-500 text-black font-medium hover:bg-orange-400 disabled:opacity-50">Save</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-slate-100">{p.subject}</p>
                            <pre className="whitespace-pre-wrap text-sm text-slate-200 font-sans">{p.body_md}</pre>
                            <div className="flex justify-end gap-2 pt-2">
                              <button onClick={async () => { await navigator.clipboard.writeText(`${p.subject}\n\n${p.body_md}`); showToast('success', 'Copied to clipboard') }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-[#2d3748] text-slate-300 hover:bg-[#263044]">
                                <Copy size={12} /> Copy
                              </button>
                              {section.id === 'draft' && (
                                <>
                                  <button onClick={() => { setEditing(p.id); setEditDraft({ subject: p.subject, body_md: p.body_md }) }} className="px-3 py-1.5 text-xs rounded-md border border-[#2d3748] text-slate-300 hover:bg-[#263044]">Edit draft</button>
                                  <button onClick={() => onSend(p)} disabled={busy === p.id} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-orange-500 text-black font-medium hover:bg-orange-400 disabled:opacity-50">
                                    {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Approve and send
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}
