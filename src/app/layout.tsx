import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { Toaster } from '@/components/ui/Toaster'
import { SchemaInitializer } from '@/components/layout/SchemaInitializer'

export const metadata: Metadata = {
  title: 'Yard â Creator Ops (Internal V0)',
  description: 'Citation Intelligence Creator Ops Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SchemaInitializer />
        <Sidebar />
        <TopBar />
        <main className="main-content">
          <div className="p-6">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  )
}
