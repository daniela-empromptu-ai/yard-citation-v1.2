'use client'

import { useEffect } from 'react'

export function SchemaInitializer() {
  useEffect(() => {
    // Fire-and-forget schema init on first load
    fetch('/api/db/init-schema', { method: 'POST' }).catch(console.error)
  }, [])
  return null
}
