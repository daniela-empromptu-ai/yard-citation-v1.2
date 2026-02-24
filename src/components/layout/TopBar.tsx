'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Upload, UserPlus, ChevronDown } from 'lucide-react'

const USERS = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'Jack Scrivener', email: 'jack@yard.internal', role: 'qualifier' as const },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'Arya', email: 'arya@yard.internal', role: 'outreach' as const },
  { id: 'a1000000-0000-0000-0000-000000000003', name: 'Karl McCarthy', email: 'karl@yard.internal', role: 'admin' as const },
  { id: 'a1000000-0000-0000-0000-000000000004', name: 'Empromptu', email: 'admin@empromptu.internal', role: 'admin' as const },
]

const ROLE_COLORS: Record<string, string> = {
  qualifier: 'bg-purple-100 text-purple-700',
  outreach: 'bg-blue-100 text-blue-700',
  admin: 'bg-amber-100 text-amber-700',
}

export function TopBar() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(USERS[0])
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('yard_current_user')
      if (saved) setCurrentUser(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  const switchUser = (user: typeof USERS[0]) => {
    setCurrentUser(user)
    localStorage.setItem('yard_current_user', JSON.stringify(user))
    setShowUserMenu(false)
    window.dispatchEvent(new Event('yard_user_changed'))
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) router.push(`/creators?q=${encodeURIComponent(search)}`)
  }

  return (
    <header className="topbar fixed bg-white border-b border-slate-200 flex items-center gap-4 px-6 z-20">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative flex-1 max-w-lg">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search campaigns, creators, promptsâ¦"
          className="w-full pl-8 pr-3 h-8 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
        <button className="flex items-center gap-1.5 px-3 h-8 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
          <Upload size={13} />
          Import CSV
        </button>
        <button className="flex items-center gap-1.5 px-3 h-8 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50">
          <UserPlus size={13} />
          Add Creator
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Badge */}
      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200 tracking-widest uppercase">
        Internal V0
      </span>

      {/* Role/User switcher */}
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center gap-2 px-3 h-8 border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-bold">
            {currentUser.name.charAt(0)}
          </div>
          <span className="text-xs font-medium text-slate-700">{currentUser.name}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${ROLE_COLORS[currentUser.role]}`}>
            {currentUser.role}
          </span>
          <ChevronDown size={12} className="text-slate-400" />
        </button>

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <div className="p-2 border-b border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide px-2">Switch User / Role</p>
              </div>
              {USERS.map(u => (
                <button
                  key={u.id}
                  onClick={() => switchUser(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 ${currentUser.id === u.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase ${ROLE_COLORS[u.role]}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </header>
  )
}
