'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'
import { useCampaignName } from './useCampaignName'

function useBreadcrumb() {
  const pathname = usePathname()
  const { name: campaignName } = useCampaignName()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: 'Workspace', href: '/' }]

  const crumbs: { label: string; href: string }[] = [{ label: 'Workspace', href: '/' }]
  if (segments[0] === 'campaigns') {
    crumbs.push({ label: 'Campaigns', href: '/campaigns' })
    if (segments[1] && segments[1] !== 'new') {
      crumbs.push({ label: campaignName || '…', href: `/campaigns/${segments[1]}` })
      if (segments[2]) {
        crumbs.push({
          label: segments[2].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          href: `/campaigns/${segments[1]}/${segments[2]}`,
        })
      }
    } else if (segments[1] === 'new') {
      crumbs.push({ label: 'New', href: '/campaigns/new' })
    }
  } else {
    crumbs.push({
      label: segments[0].replace(/\b\w/g, (c) => c.toUpperCase()),
      href: '/' + segments[0],
    })
  }
  return crumbs
}

export function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const crumbs = useBreadcrumb()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/creators?q=${encodeURIComponent(search)}`)
  }

  const showNewCampaign = pathname === '/campaigns'

  return (
    <header
      className="topbar fixed flex items-center gap-4 px-6 z-20"
      style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[13px]">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <span key={c.href} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
              <Link
                href={c.href}
                style={{ color: isLast ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                className="hover:opacity-80 transition-opacity"
              >
                {c.label}
              </Link>
            </span>
          )
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <form onSubmit={handleSearch} className="relative w-72">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full pl-8 pr-12 h-8 text-[13px] rounded-md focus:outline-none focus:ring-2"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          ⌘K
        </span>
      </form>

      {/* Contextual action */}
      {showNewCampaign && (
        <button
          onClick={() => router.push('/campaigns/new')}
          className="btn-primary h-8 text-[13px]"
        >
          <Plus size={14} />
          New campaign
        </button>
      )}
    </header>
  )
}
