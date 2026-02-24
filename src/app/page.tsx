'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScorePill } from '@/components/ui/ScorePill'
import { CoverageBadge, OutreachBadge, PipelineBadge } from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle, Clock, Users, Megaphone, Send, BarChart3, Calendar, RefreshCw } from 'lucide-react'

const USERS = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'Jack Scrivener', role: 'qualifier' },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'Arya', role: 'outreach' },
  { id: 'a1000000-0000-0000-0000-000000000003', name: 'Karl McCarthy', role: 'admin' },
  { id: 'a1000000-0000-0000-0000-000000000004', name: 'Empromptu', role: 'admin' },
]

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState(USERS[0])

  const loadUser = () => {
    try {
      const saved = localStorage.getItem('yard_current_user')
      if (saved) {
        const u = JSON.parse(saved)
        const found = USERS.find(usr => usr.id === u.id)
        if (found) setCurrentUser(found)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    loadUser()
    window.addEventListener('yard_user_changed', loadUser)
    return () => window.removeEventListener('yard_user_changed', loadUser)
  }, [])

  const load = () => {
    setLoading(true)
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 mt-12">
      <RefreshCw size={16} className="animate-spin" />
      <span>Loading dashboardâ¦</span>
    </div>
  )
  if (error) return <div className="text-red-600 mt-6 p-4 bg-red-50 rounded-lg border border-red-200">Error: {error}</div>
  if (!data) return null

  const stats = (data.stats || {}) as Record<string, number>
  const needsReview = (data.needsReview || []) as Record<string, unknown>[]
  const recentScoring = (data.recentScoring || []) as Record<string, unknown>[]
  const outreachQueue = (data.outreachQueue || []) as Record<string, unknown>[]
  const recentBooked = (data.recentBooked || []) as Record<string, unknown>[]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {currentUser.role === 'qualifier' && 'ð Qualifier Dashboard'}
            {currentUser.role === 'outreach' && 'ð¤ Outreach Dashboard'}
            {currentUser.role === 'admin' && 'âï¸ Admin Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Welcome back, {currentUser.name}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* QUALIFIER VIEW */}
      {(currentUser.role === 'qualifier' || currentUser.role === 'admin') && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Analyzed this week" value={stats.analyzed_week || 0} icon={BarChart3} color="bg-blue-500" />
            <StatCard label="Needs manual review" value={stats.needs_review || 0} icon={AlertTriangle} color="bg-amber-500" />
            <StatCard label="Approved for outreach" value={stats.outreach_ready || 0} icon={CheckCircle} color="bg-green-500" />
            <StatCard label="Active campaigns" value={stats.active_campaigns || 0} icon={Megaphone} color="bg-purple-500" />
          </div>

          {/* Needs Manual Review Queue */}
          <div className="bg-white border border-slate-200 rounded-xl mb-6">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-800">Needs Manual Review Queue</h2>
                {needsReview.length > 0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">{needsReview.length}</span>
                )}
              </div>
            </div>
            {needsReview.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                No creators pending manual review
              </div>
            ) : (
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Creator</th>
                    <th className="text-left">Campaign</th>
                    <th className="text-left">Coverage</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Reason</th>
                    <th className="text-left">Last Updated</th>
                    <th className="text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {needsReview.map((row) => (
                    <tr key={String(row.cc_id)}>
                      <td className="font-medium text-slate-800">{String(row.display_name)}</td>
                      <td className="text-slate-600">{String(row.campaign_name)}</td>
                      <td><CoverageBadge coverage={String(row.evidence_coverage || 'none')} /></td>
                      <td>{row.overall_score !== null ? <ScorePill score={Number(row.overall_score)} /> : 'â'}</td>
                      <td className="text-slate-500 text-xs max-w-xs truncate">{String(row.needs_manual_review_reason || 'â')}</td>
                      <td className="text-slate-400 text-xs">{row.updated_at ? new Date(String(row.updated_at)).toLocaleDateString() : 'â'}</td>
                      <td>
                        <Link href="/campaigns" className="text-xs font-medium text-blue-600 hover:underline">Open Review â</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent Scoring Runs */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <BarChart3 size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-800">Recent Scoring Runs</h2>
            </div>
            {recentScoring.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No scoring runs yet. Seed demo data in Settings.</div>
            ) : (
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Creator</th>
                    <th className="text-left">Campaign</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Coverage</th>
                    <th className="text-left">Scored At</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScoring.map((row) => (
                    <tr key={String(row.id)}>
                      <td className="font-medium text-slate-800">{String(row.display_name)}</td>
                      <td className="text-slate-600">{String(row.campaign_name)}</td>
                      <td><ScorePill score={Number(row.overall_score)} /></td>
                      <td><CoverageBadge coverage={String(row.evidence_coverage)} /></td>
                      <td className="text-slate-400 text-xs">{row.evaluated_at ? new Date(String(row.evaluated_at)).toLocaleDateString() : 'â'}</td>
                      <td>{row.needs_manual_review ? <span className="text-amber-600 text-xs font-medium">Needs Review</span> : <span className="text-green-600 text-xs font-medium">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* OUTREACH VIEW */}
      {currentUser.role === 'outreach' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Emails to send" value={stats.emails_to_send || 0} icon={Send} color="bg-blue-500" />
            <StatCard label="Follow-ups due" value={stats.followups_due || 0} icon={Calendar} color="bg-amber-500" />
            <StatCard label="Replies to log" value={stats.replies_to_log || 0} icon={CheckCircle} color="bg-purple-500" />
            <StatCard label="Booked (all time)" value={stats.booked_count || 0} icon={Users} color="bg-green-500" />
          </div>

          {/* Disclaimer */}
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <AlertTriangle size={14} />
            <span className="font-medium">This tool does not send emails.</span>
            <span className="text-amber-600">Assistive only â human approval required before outreach.</span>
          </div>

          {/* Outreach Queue */}
          <div className="bg-white border border-slate-200 rounded-xl mb-6">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <Send size={15} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-800">Outreach Queue</h2>
            </div>
            {outreachQueue.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No creators ready for outreach.</div>
            ) : (
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Creator</th>
                    <th className="text-left">Campaign</th>
                    <th className="text-left">State</th>
                    <th className="text-left">Next Follow-up</th>
                    <th className="text-left">Owner</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Coverage</th>
                    <th className="text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {outreachQueue.map((row) => (
                    <tr key={String(row.id)}>
                      <td className="font-medium text-slate-800">{String(row.display_name)}</td>
                      <td className="text-slate-600">{String(row.campaign_name)}</td>
                      <td><OutreachBadge state={String(row.outreach_state)} /></td>
                      <td className="text-slate-500 text-xs">{row.next_followup_due_at ? String(row.next_followup_due_at) : 'â'}</td>
                      <td className="text-slate-500 text-xs">{String(row.outreach_owner_name || 'â')}</td>
                      <td>{row.overall_score !== null ? <ScorePill score={Number(row.overall_score)} /> : 'â'}</td>
                      <td>{row.evidence_coverage ? <CoverageBadge coverage={String(row.evidence_coverage)} /> : 'â'}</td>
                      <td>
                        <Link href={`/outreach`} className="text-xs font-medium text-blue-600 hover:underline">Open Packet â</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recently Replied/Booked */}
          <div className="bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
              <CheckCircle size={15} className="text-green-500" />
              <h2 className="text-sm font-semibold text-slate-800">Recently Replied / Booked</h2>
            </div>
            {recentBooked.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No recent replies or bookings.</div>
            ) : (
              <table className="dense-table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Creator</th>
                    <th className="text-left">Campaign</th>
                    <th className="text-left">State</th>
                    <th className="text-left">Last Activity</th>
                    <th className="text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBooked.map((row) => (
                    <tr key={String(row.id)}>
                      <td className="font-medium text-slate-800">{String(row.display_name)}</td>
                      <td className="text-slate-600">{String(row.campaign_name)}</td>
                      <td><OutreachBadge state={String(row.outreach_state)} /></td>
                      <td className="text-slate-400 text-xs">{row.last_activity ? new Date(String(row.last_activity)).toLocaleDateString() : 'â'}</td>
                      <td className="text-slate-500 text-xs max-w-xs truncate">{String(row.last_notes || 'â')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Evidence disclaimer */}
      <div className="mt-6 text-center text-xs text-slate-400">
        Evidence required for all scores and recommendations. Â· Assistive only â human approval required before outreach. Â· This tool does not send emails.
      </div>
    </div>
  )
}
