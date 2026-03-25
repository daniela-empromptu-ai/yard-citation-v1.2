import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { SchemaInitializer } from '@/components/layout/SchemaInitializer'
import { AuthProvider } from '@/components/layout/AuthProvider'
import { AuthShell } from '@/components/layout/AuthShell'

export const metadata: Metadata = {
  title: 'Yard — Creator Ops',
  description: 'Citation Intelligence Creator Ops Tool',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SchemaInitializer />
          <AuthShell>{children}</AuthShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
