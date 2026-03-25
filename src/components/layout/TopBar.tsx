'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

const ROLE_COLORS: Record<string, string> = {
  qualifier: 'bg-purple-900/30 text-purple-400',
  outreach: 'bg-blue-900/30 text-blue-400',
  admin: 'bg-amber-900/30 text-amber-400',
}

export function TopBar() {
  const router = useRouter()
  const { data: session } = useSession()
  const [search, setSearch] = useState('')

  const user = session?.user

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/creators?q=${encodeURIComponent(search)}`)
  }

  return (
    <header className="topbar fixed bg-[#1e293b] border-b border-[#2d3748] flex items-center gap-4 px-6 z-20">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative flex-1 max-w-lg">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns, creators, prompts…"
          className="w-full pl-8 pr-3 h-8 text-sm border border-[#2d3748] rounded-lg bg-[#111827] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push('/campaigns/new')}
          className="flex items-center gap-1.5 px-3 h-8 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={13} />
          New Campaign
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Badge */}
      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-800/50 text-slate-500 rounded border border-slate-600/50 tracking-widest uppercase">
        Beta
      </span>

      {/* Current user + sign out */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 h-8 border border-[#2d3748] rounded-lg">
            <div className="w-6 h-6 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 text-[10px] font-bold">
              {user.name?.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-300">{user.name}</span>
            {user.role && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${ROLE_COLORS[user.role] || 'bg-slate-800 text-slate-400'}`}>
                {user.role}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
