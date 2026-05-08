'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import type { VisibilityAnalysis } from '@/lib/gumshoe'

interface Props {
  campaign: { id: string; gumshoe_notes: string | null }
}

interface ApiResponse {
  available: boolean
  cached?: boolean
  age_ms?: number
  analysis?: VisibilityAnalysis
  reason?: string
}

export default function AnalysisTab({ campaign }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refetching, setRefetching] = useState(false)

  const load = async (force: boolean) => {
    if (force) setRefetching(true); else setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/visibility-analysis${force ? '?force=1' : ''}`, { cache: 'no-store' })
      const json = (await res.json()) as ApiResponse
      setData(json)
    } finally {
      setLoading(false); setRefetching(false)
    }
  }

  useEffect(() => { load(false) }, [campaign.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading analysis…
      </div>
    )
  }

  if (!data?.available) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="card p-8 text-center bg-[#1e293b] rounded-2xl border border-[#2d3748]">
          <AlertTriangle size={28} className="text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-100 mb-2">Visibility analysis unavailable</h3>
          <p className="text-sm text-slate-400">
            {data?.reason || 'Add a Gumshoe report URL on the Setup tab to enable visibility analysis.'}
          </p>
        </div>
      </div>
    )
  }

  const a = data.analysis!

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Generated {new Date(a.generated_at).toLocaleString()} {data.cached ? '· cached' : ''}
        </p>
        <button
          onClick={() => load(true)}
          disabled={refetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-[#2d3748] text-slate-300 hover:bg-[#263044] disabled:opacity-50"
        >
          <RefreshCw size={12} className={refetching ? 'animate-spin' : ''} /> Re-run
        </button>
      </div>

      {/* Score + Leaderboard */}
      <div className="grid grid-cols-2 gap-5">
        <Card title="AI visibility score" subtitle={`Across ${a.total_answers} answers analyzed.`}>
          <div className="flex items-baseline gap-3 mt-3">
            <span className="text-6xl font-bold text-orange-400">{a.visibility_score}</span>
            <span className="text-sm text-slate-400">out of 100</span>
          </div>
          {a.category_rank != null && (
            <p className="text-xs text-slate-500 mt-2">↓ {ordinal(a.category_rank)} in category</p>
          )}
          <div className="mt-4 p-3 rounded-lg bg-[#0f172a] text-xs text-slate-400">
            Only {a.visibility_score}% of answers mention {a.brand.name}. Every uncited source is a placement opportunity.
          </div>
        </Card>

        <Card title="Category leaderboard" subtitle={`Share of mentions across ${a.total_answers} answers.`}>
          <div className="space-y-2 mt-3">
            {a.leaderboard.map((row, i) => (
              <div key={row.brand} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-4">{i + 1}</span>
                <span className={`text-sm flex-1 truncate ${row.is_us ? 'text-orange-400 font-semibold' : 'text-slate-200'}`}>
                  {row.brand}{row.is_us ? ' · you' : ''}
                </span>
                <Bar pct={row.share_pct} highlight={row.is_us} />
                <span className={`text-xs w-10 text-right ${row.is_us ? 'text-orange-400' : 'text-slate-400'}`}>{row.share_pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Gap topics */}
      <Card title="Gap topics" subtitle={`Topics where ${a.brand.name} trails the leader.`}>
        {a.gap_topics.length === 0 ? (
          <p className="text-sm text-slate-500 mt-3">No clear topical gaps — you appear in topics at parity or better.</p>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-slate-500 px-1 pb-2">
              <span className="col-span-4">Topic</span>
              <span className="col-span-7">Share of voice</span>
              <span className="col-span-1 text-right">Gap</span>
            </div>
            <div className="space-y-3">
              {a.gap_topics.map(t => (
                <div key={t.topic} className="grid grid-cols-12 items-center gap-3">
                  <span className="col-span-4 text-sm text-slate-200 truncate">{t.topic}</span>
                  <div className="col-span-7 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-14 truncate">{a.brand.name}</span>
                      <Bar pct={t.my_share_pct} highlight />
                      <span className="text-[10px] text-slate-400 w-8 text-right">{t.my_share_pct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 w-14 truncate">{t.leader}</span>
                      <Bar pct={t.leader_share_pct} />
                      <span className="text-[10px] text-slate-400 w-8 text-right">{t.leader_share_pct}%</span>
                    </div>
                  </div>
                  <span className="col-span-1 text-sm text-rose-400 text-right">−{t.gap}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Source breakdown */}
      <Card title="Source breakdown" subtitle={`Top domains AIs cite when asked about this category.`}>
        <div className="space-y-2 mt-3">
          {a.source_breakdown.map(row => (
            <div key={row.domain} className="flex items-center gap-3">
              <span className="text-sm text-slate-200 flex-1 truncate">{row.domain}</span>
              <Bar pct={Math.round((row.total / (a.source_breakdown[0]?.total || 1)) * 100)} />
              <span className="text-xs text-slate-400 w-8 text-right">{row.total}</span>
              <span className={`text-xs w-14 text-right ${row.my_cites > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                {row.my_cites} cites
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-center pt-4">
        <button
          onClick={() => router.push(`/campaigns/${campaign.id}/opportunities`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-black font-medium hover:bg-orange-400"
        >
          View opportunities <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 bg-[#1e293b] rounded-2xl border border-[#2d3748]">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      {children}
    </div>
  )
}

function Bar({ pct, highlight = false }: { pct: number; highlight?: boolean }) {
  const w = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex-1 h-1.5 bg-[#0f172a] rounded-full overflow-hidden">
      <div
        className={highlight ? 'h-full bg-orange-400' : 'h-full bg-slate-500'}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
