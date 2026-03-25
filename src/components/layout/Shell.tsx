'use client'

import { useSession } from 'next-auth/react'

export function useRole(): { userId: string; role: string; userName: string } {
  const { data: session } = useSession()

  return {
    userId: session?.user?.id || '',
    role: session?.user?.role || '',
    userName: session?.user?.name || '',
  }
}
