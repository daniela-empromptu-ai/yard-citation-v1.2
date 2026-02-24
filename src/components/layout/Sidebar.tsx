'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  LayoutDashboard, Megaphone, Users, Send, MessageSquare,
  BarChart3, Settings, ChevronRight, Zap
} from 'lucide-react'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/creators', label: 'Creators', icon: Users },
  { href: '/outreach', label: 'Outreach', icon: Send },
  { href: '/reddit', label: 'Reddit Monitor', icon: MessageSquare },
  { href: '/metrics', label: 'Metrics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="sidebar fixed top-0 left-0 bg-slate-900 text-white flex flex-col z-30 border-r border-slate-700">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-14 border-b border-slate-700">
        <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
          <Zap size={14} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-none">Yard</div>
          <div className="text-[10px] text-slate-400 leading-none mt-0.5">Creator Ops</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors group',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon size={16} className={active ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
              <span className="font-medium">{label}</span>
              {active && <ChevronRight size={12} className="ml-auto text-blue-300" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-700">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest">Internal V0</div>
        <div className="text-[11px] text-slate-400 mt-0.5">Evidence required for all scores</div>
      </div>
    </aside>
  )
}
