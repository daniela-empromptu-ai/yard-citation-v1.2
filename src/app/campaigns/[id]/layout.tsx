'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { StageBadge } from '@/components/ui/Badge'
import { RefreshCw, ChevronRight } from 'lucide-react'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'brief-inputs', label: 'Brief & Inputs' },
  { key: 'search-terms', label: 'Search Terms' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'ingestion', label: 'Ingestion' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'review', label: 'Review' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'activity', label: 'Activity' },
]

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const id = params.id as string
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  const loadCampaign = useCallback(() => {
    fetch(`/api/campaigns/${id}`)
      .then(r => r.json())
      .then(d => { setCampaign(d.campaign || null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => { loadCampaign() }, [loadCampaign])

  const activeTab = TABS.find(t => pathname.endsWith(t.key))?.key || 'overview'

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Breadcrumb + campaign header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <Link href="/campaigns" className="hover:text-blue-600">Campaigns</Link>
            <ChevronRight size={11} />
            <span className="text-slate-600 font-medium truncate max-w-sm">
              {loading ? 'â¦' : String(campaign?.name || id)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-800 truncate max-w-xl">
              {loading ? 'â¦' : String(campaign?.name || 'Campaign')}
            </h1>
            {campaign && <StageBadge stage={String(campaign.stage)} />}
          </div>
          {campaign && (
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
              <span>{String(campaign.client_name)}</span>
              <span>Â·</span>
              <span>Owner: {String(campaign.owner_name)}</span>
              {campaign.language && <><span>Â·</span><span>{String(campaign.language)}</span></>}
            </div>
          )}
        </div>
        <button onClick={loadCampaign} className="flex items-center gap-1.5 px-3 h-7 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 border-b border-slate-200">
        {TABS.map(tab => (
          <Link
            key={tab.key}
            href={`/campaigns/${id}/${tab.key}`}
            className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  )
}
