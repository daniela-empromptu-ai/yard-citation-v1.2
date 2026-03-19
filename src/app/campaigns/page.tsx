'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StageBadge } from '@/components/ui/Badge'
import { Plus, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/ui/EmptyState'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20
  const router = useRouter()

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

  const filtered = campaigns.filter(c =>
    !search || String(c.name).toLowerCase().includes(search.toLowerCase()) ||
    String(c.client_name).toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Campaigns</h1>
          <p className="text-sm text-slate-400 mt-0.5">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter campaigns…"
              className="pl-8 pr-3 h-8 text-xs border border-[#2d3748] rounded-lg bg-[#111827] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 h-8 border border-[#2d3748] rounded-lg text-xs text-slate-400 hover:bg-[#263044]">
            <RefreshCw size={12} />
          </button>
          <button onClick={() => router.push('/campaigns/new')} className="flex items-center gap-1.5 px-3 h-8 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700">
            <Plus size={13} /> New Campaign
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500"><RefreshCw size={14} className="animate-spin" /> Loading…</div>
      )}

      {error && (
        <div className="p-4 bg-red-900/20 rounded-lg border border-red-700/40">
          <p className="text-red-400 text-sm">Error: {error}</p>
          <button onClick={load} className="mt-2 text-xs text-red-300 underline hover:no-underline">Retry</button>
        </div>
      )}

      {!loading && !error && (<>
        <div className="bg-[#1e293b] border border-[#2d3748] rounded-xl overflow-hidden">
          {paged.length === 0 ? (
            <EmptyState
              icon="\ud83d\udce2"
              title="No campaigns found"
              description="Seed demo data in Settings or create a new campaign"
              action={{ label: 'Create Campaign', onClick: () => router.push('/campaigns/new') }}
            />
          ) : (
            <table className="table-dense w-full">
              <thead>
                <tr>
                  <th className="text-left">Campaign Name</th>
                  <th className="text-left">Client</th>
                  <th className="text-left">Stage</th>
                  <th className="text-left">GEO Targets</th>
                  <th className="text-left">Owner</th>
                  <th className="text-left">Creators</th>
                  <th className="text-left">Scored</th>
                  <th className="text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(c => (
                  <tr
                    key={String(c.id)}
                    className="cursor-pointer hover:bg-[#263044]"
                    onClick={() => router.push(`/campaigns/${c.id}/setup`)}
                  >
                    <td>
                      <Link
                        href={`/campaigns/${c.id}/setup`}
                        className="font-semibold text-slate-200 hover:text-blue-400"
                        onClick={e => e.stopPropagation()}
                      >
                        {String(c.name)}
                      </Link>
                    </td>
                    <td className="text-slate-400">{String(c.client_name)}</td>
                    <td><StageBadge stage={String(c.stage)} /></td>
                    <td className="text-xs text-slate-500">
                      {Array.isArray(c.geo_targets) ? c.geo_targets.join(', ') : String(c.geo_targets || '')}
                    </td>
                    <td className="text-slate-400 text-sm">{String(c.owner_name)}</td>
                    <td className="text-slate-300 font-medium">{String(c.creator_count || 0)}</td>
                    <td>
                      <span className={`text-sm font-medium ${Number(c.scored_count) > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                        {String(c.scored_count || 0)}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs">
                      {c.updated_at ? new Date(String(c.updated_at)).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>Page {page} of {totalPages} ({filtered.length} campaigns)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 border border-[#2d3748] rounded-lg text-xs text-slate-400 hover:bg-[#263044] disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 border border-[#2d3748] rounded-lg text-xs text-slate-400 hover:bg-[#263044] disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}
