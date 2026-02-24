'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StageBadge } from '@/components/ui/Badge'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const router = useRouter()

  const load = () => {
    setLoading(true)
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => { setCampaigns(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const filtered = campaigns.filter(c =>
    !search || String(c.name).toLowerCase().includes(search.toLowerCase()) ||
    String(c.client_name).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter campaignsâ¦"
              className="pl-8 pr-3 h-8 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => router.push('/campaigns/new')} className="flex items-center gap-1.5 px-3 h-8 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
            <Plus size={13} /> New Campaign
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500"><RefreshCw size={14} className="animate-spin" /> Loadingâ¦</div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200 text-sm">Error: {error}</div>
      )}

      {!loading && !error && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="text-slate-300 text-4xl mb-3">ð</div>
              <div className="text-slate-500 font-medium">No campaigns found</div>
              <p className="text-slate-400 text-sm mt-1">Seed demo data in Settings or create a new campaign</p>
              <button onClick={() => router.push('/campaigns/new')} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Create Campaign
              </button>
            </div>
          ) : (
            <table className="dense-table w-full">
              <thead>
                <tr>
                  <th className="text-left">Campaign Name</th>
                  <th className="text-left">Client</th>
                  <th className="text-left">Stage</th>
                  <th className="text-left">GEO Targets</th>
                  <th className="text-left">Owner</th>
                  <th className="text-left">Creators</th>
                  <th className="text-left">Outreach-Ready</th>
                  <th className="text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={String(c.id)}
                    className="cursor-pointer hover:bg-blue-50"
                    onClick={() => router.push(`/campaigns/${c.id}/overview`)}
                  >
                    <td>
                      <Link
                        href={`/campaigns/${c.id}/overview`}
                        className="font-semibold text-slate-800 hover:text-blue-600"
                        onClick={e => e.stopPropagation()}
                      >
                        {String(c.name)}
                      </Link>
                    </td>
                    <td className="text-slate-600">{String(c.client_name)}</td>
                    <td><StageBadge stage={String(c.stage)} /></td>
                    <td className="text-xs text-slate-500">
                      {Array.isArray(c.geo_targets) ? c.geo_targets.join(', ') : String(c.geo_targets || '')}
                    </td>
                    <td className="text-slate-600 text-sm">{String(c.owner_name)}</td>
                    <td className="text-slate-700 font-medium">{String(c.creator_count || 0)}</td>
                    <td>
                      <span className={`text-sm font-medium ${Number(c.outreach_ready_count) > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                        {String(c.outreach_ready_count || 0)}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">
                      {c.updated_at ? new Date(String(c.updated_at)).toLocaleDateString() : 'â'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
