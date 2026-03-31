'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScorePill } from '@/components/ui/ScorePill'
import { CoverageBadge, PlatformBadge } from '@/components/ui/Badge'
import { AlertTriangle, CheckCircle, Users, Megaphone, BarChart3, RefreshCw, Database, Activity } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { formatDateTime } from '@/lib/utils'

export default function DashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-500 mt-12 justify-center">
      <RefreshCw size={16} className="animate-spin" />
      <span>Loading dashboard...</span>
    </div>
  )
  if (error) return (
    <div className="mt-6 p-4 bg-red-900/20 rounded-lg border border-red-700/40">
      <p className="text-red-400 text-sm">Error: {error}</p>
      <button onClick={load} className="mt-2 text-xs text-red-300 underline hover:no-underline">Retry</button>
    </div>
  )
  if (!data) return null

  const stats = (data.stats || {}) as Record<string, number>
  const needsReview = (data.needsReview || []) as Record<string, unknown>[]
  const recentScoring = (data.recentScoring || []) as Record<string, unknown>[]
  const recentActivity = (data.recentActivity || []) as Record<string, unknown>[]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Campaign scoring and creator discovery at a glance</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 border border-[#2d3748] rounded-lg text-xs text-slate-400 hover:bg-[#263044]">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8 items-stretch">
        <StatCard label="Active campaigns" value={stats.active_campaigns || 0} icon={Megaphone} color="bg-purple-500" />
        <StatCard label="Creator database" value={stats.total_creators || 0} icon={Database} color="bg-blue-500" />
        <StatCard label="Scored this week" value={stats.scored_this_week || 0} icon={BarChart3} color="bg-green-500" />
        <StatCard label="Needs review" value={stats.needs_review || 0} icon={AlertTriangle} color="bg-amber-500" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column: Tables */}
        <div className="col-span-2 space-y-6">
          {/* Recent Scoring Runs */}
          <div className="bg-[#1e293b] border border-[#2d3748] rounded-xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2d3748]">
              <BarChart3 size={15} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-200">Recent Scoring</h2>
            </div>
            {recentScoring.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">
                No scoring runs yet. Create a campaign and run discovery first.
              </div>
            ) : (
              <table className="table-dense w-full">
                <thead>
                  <tr>
                    <th className="text-left">Creator</th>
                    <th className="text-left">Campaign</th>
                    <th className="text-left">Score</th>
                    <th className="text-left">Coverage</th>
                    <th className="text-left">Scored</th>
                    <th className="text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScoring.map((row) => (
                    <tr key={String(row.id)}>
                      <td>
                        <span className="font-medium text-slate-200">{String(row.creator_name)}</span>
                        {row.platform ? <PlatformBadge platform={String(row.platform)} /> : null}
                      </td>
                      <td>
                        <Link href={`/campaigns/${row.campaign_id}/creators`} className="text-slate-400 hover:text-blue-400 hover:underline">
                          {String(row.campaign_name)}
                        </Link>
                      </td>
                      <td><ScorePill score={Number(row.overall_score)} /></td>
                      <td><CoverageBadge coverage={String(row.evidence_coverage || 'none')} /></td>
                      <td className="text-slate-500 text-xs">{row.evaluated_at ? formatDateTime(String(row.evaluated_at)) : '—'}</td>
                      <td>{row.needs_manual_review ? <span className="text-amber-400 text-xs font-medium">Needs Review</span> : <span className="text-green-400 text-xs font-medium">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right column: Activity feed */}
        <div className="col-span-1">
          <div className="bg-[#1e293b] border border-[#2d3748] rounded-xl">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-[#2d3748]">
              <Activity size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Recent Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-slate-500 text-sm">No activity yet.</div>
            ) : (
              <div className="divide-y divide-[#1e293b]">
                {recentActivity.map((evt, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 leading-relaxed">
                          <span className="font-medium">{formatEventType(String(evt.event_type))}</span>
                          {evt.creator_name ? <span className="text-slate-500"> — {String(evt.creator_name)}</span> : null}
                        </p>
                        {evt.campaign_name ? (
                          <Link href={`/campaigns/${evt.campaign_id}`} className="text-[11px] text-blue-400 hover:underline">
                            {String(evt.campaign_name)}
                          </Link>
                        ) : null}
                        <p className="text-[11px] text-slate-600 mt-0.5">{evt.created_at ? formatDateTime(String(evt.created_at)) : ''}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex items-center gap-4 justify-center">
        <Link href="/campaigns" className="text-xs text-slate-500 hover:text-blue-400 hover:underline flex items-center gap-1">
          <Megaphone size={12} /> All Campaigns
        </Link>
        <Link href="/creators" className="text-xs text-slate-500 hover:text-blue-400 hover:underline flex items-center gap-1">
          <Users size={12} /> Creator Database
        </Link>
      </div>
    </div>
  )
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    'discovery_started': 'Discovery started',
    'discovery_completed': 'Discovery completed',
    'scoring_started': 'Scoring started',
    'scoring_completed': 'Scoring completed',
    'evaluation_completed': 'Creator evaluated',
    'creator_added': 'Creator added',
    'creator_excluded': 'Creator excluded',
    'campaign_created': 'Campaign created',
    'search_terms_generated': 'Search terms generated',
    'prequalify_completed': 'Pre-qualify completed',
  }
  return map[type] || type.replace(/_/g, ' ')
}
