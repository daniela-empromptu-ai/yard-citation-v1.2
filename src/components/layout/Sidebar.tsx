'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import clsx from 'clsx'
import {
  Megaphone, Inbox, UserSquare2, Bell,
  Settings2, BarChart3, Sparkles, Send, Boxes, Eye, Check, LogOut,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useCampaignName } from './useCampaignName'
import { useEffect, useState } from 'react'

const CAMPAIGN_STEPS = [
  { id: 'setup', label: 'Setup', icon: Settings2 },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'opportunities', label: 'Opportunities', icon: Sparkles },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'production', label: 'Production', icon: Boxes, locked: true },
  { id: 'client-view', label: 'Client view', icon: Eye, locked: true },
]

const NAV_BASE = [
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/inbox', label: 'Inbox', icon: Inbox, count: 'TBD' as string | number },
  { href: '/experts', label: 'Experts', icon: UserSquare2 },
  { href: '/alerts', label: 'Alerts', icon: Bell },
]

export function Sidebar() {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const { data: session } = useSession()
  const user = session?.user
  const [campaignCount, setCampaignCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCampaignCount(d.length) })
      .catch(() => {})
  }, [])

  const inCampaign = pathname.startsWith('/campaigns/') && params?.id
  const urlStep = inCampaign ? (pathname.split('/')[3] || 'setup') : null
  const { name: campaignName, stage: campaignStage } = useCampaignName()
  const railLabel = campaignName || 'Campaign'
  const railInitial = (campaignName || 'C').charAt(0).toUpperCase()

  // Map DB stage → workflow step id
  const STAGE_TO_STEP: Record<string, string> = {
    draft: 'setup', setup: 'setup',
    discovery: 'analysis', analysis: 'analysis',
    // pipeline stages that mean "scoring done, ready for outreach"
    scoring: 'outreach', scored: 'outreach', review: 'outreach',
    engage: 'outreach', opportunities: 'outreach', outreach: 'outreach',
    production: 'production',
    'client-view': 'client-view', live: 'client-view',
  }
  const progressStep = campaignStage
    ? (STAGE_TO_STEP[campaignStage] ?? urlStep ?? 'setup')
    : (urlStep ?? 'setup')

  return (
    <aside
      className="sidebar fixed top-0 left-0 flex flex-col z-30"
      style={{ background: 'var(--bg-app)', borderRight: '1px solid var(--border-subtle)' }}
    >
      {/* Logo */}
      <div className="flex items-center px-5 h-14">
        <img src="/yard-logo.svg" alt="yard" style={{ height: 22, width: 'auto' }} />
      </div>

      {/* Workspace nav */}
      <div className="px-5 mt-2 mb-2">
        <div className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Workspace
        </div>
      </div>
      <nav className="px-2">
        {NAV_BASE.map(({ href, label, icon: Icon, count: baseCount }) => {
          const count = href === '/campaigns' ? (campaignCount ?? undefined) : baseCount
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 px-3 py-2 mx-1 rounded-lg text-[13px] transition-colors"
              style={
                active
                  ? { background: 'var(--bg-surface)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {/* Orange left accent bar */}
              {active && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <Icon size={15} />
              <span className="flex-1 font-medium">{label}</span>
              {count !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold"
                  style={active
                    ? { background: 'var(--accent)', color: '#000' }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-muted)' }
                  }
                >
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Campaign workflow rail */}
      {inCampaign && (
        <div className="mt-6 px-2">
          <div className="px-3 mb-2 flex items-center gap-2">
            <div
              className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              {railInitial}
            </div>
            <span
              className="text-[11px] font-semibold uppercase tracking-widest truncate"
              style={{ color: 'var(--text-secondary)' }}
              title={railLabel}
            >
              {railLabel}
            </span>
          </div>
          <div className="relative">
            {/* Connecting line behind nodes */}
            <div
              className="absolute w-px"
              style={{
                left: 19,
                top: 12,
                bottom: 12,
                background: 'var(--border-default)',
              }}
            />
            {CAMPAIGN_STEPS.map((step) => {
              const progressIndex = CAMPAIGN_STEPS.findIndex((s) => s.id === progressStep)
              const stepIndex = CAMPAIGN_STEPS.findIndex((s) => s.id === step.id)
              const completed = stepIndex < progressIndex
              const current = step.id === progressStep
              const future = stepIndex > progressIndex
              const isUrlActive = step.id === urlStep
              const reachable = !step.locked

              return (
                <Link
                  key={step.id}
                  href={reachable ? `/campaigns/${params!.id}/${step.id}` : '#'}
                  onClick={(e) => { if (!reachable) e.preventDefault() }}
                  className="relative flex items-center gap-3 px-3 py-1.5 mx-1 rounded-md text-[13px] transition-colors"
                  style={{
                    background: isUrlActive ? 'var(--bg-surface)' : 'transparent',
                    color: completed || current ? 'var(--text-primary)' : future && reachable ? 'var(--text-secondary)' : 'var(--text-muted)',
                    cursor: reachable ? 'pointer' : 'default',
                    fontWeight: current ? 600 : 400,
                  }}
                >
                  <span className="relative z-10 shrink-0 flex items-center justify-center" style={{ width: 16, height: 16 }}>
                    {completed ? (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)' }}
                      >
                        <Check size={9} color="#fff" strokeWidth={3} />
                      </span>
                    ) : current ? (
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ border: '2px solid var(--accent)', background: 'var(--bg-app)' }}
                      />
                    ) : (
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ border: '1.5px solid var(--border-default)', background: 'var(--bg-app)' }}
                      />
                    )}
                  </span>
                  <span>{step.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User profile pinned */}
      {user && (
        <div className="px-3 py-3 mx-1 mb-2 mt-2 rounded-lg flex items-center gap-2.5"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {user.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {user.name}
            </div>
            <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
              {user.role || 'Ops'} · Yard
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="shrink-0 p-1 rounded transition-opacity opacity-50 hover:opacity-100"
            style={{ color: 'var(--text-muted)' }}
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      )}
    </aside>
  )
}
