'use client'

import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated' && pathname !== '/login') {
      router.replace('/login')
    }
  }, [status, pathname, router])

  // Login page renders without shell
  if (pathname === '/login') {
    return <>{children}</>
  }

  // While checking session or redirecting unauthenticated user
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
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
