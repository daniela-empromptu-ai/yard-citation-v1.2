'use client'

import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()

  // Login page renders without shell
  if (pathname === '/login') {
    return <>{children}</>
  }

  // While checking session, show minimal loading screen
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    )
  }

  // Authenticated: full shell
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="main-content">
        <div className="p-6">{children}</div>
      </main>
    </>
  )
}
