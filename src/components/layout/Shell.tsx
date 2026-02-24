'use client'

import { useState, useEffect } from 'react'

interface User {
  id: string
  name: string
  role: string
}

const DEFAULT_USER: User = {
  id: 'a1000000-0000-0000-0000-000000000001',
  name: 'Jack Scrivener',
  role: 'qualifier',
}

export function useRole(): { userId: string; role: string; userName: string } {
  const [user, setUser] = useState<User>(DEFAULT_USER)

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem('yard_current_user')
        if (saved) {
          const parsed = JSON.parse(saved) as User
          if (parsed?.id && parsed?.role) setUser(parsed)
        }
      } catch { /* ignore */ }
    }
    load()
    window.addEventListener('yard_user_changed', load)
    return () => window.removeEventListener('yard_user_changed', load)
  }, [])

  return { userId: user.id, role: user.role, userName: user.name }
}
