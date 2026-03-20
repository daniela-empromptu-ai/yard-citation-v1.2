'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function DemoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const doReset = window.location.search.includes('reset')
    ;(async () => {
      try {
        if (doReset) {
          await fetch('/api/demo/setup', { method: 'DELETE' })
        }
        const res = await fetch('/api/demo/setup', { method: 'POST' })
        const data = await res.json()
        if (data.campaign_id) {
          router.replace(`/campaigns/${data.campaign_id}/engage`)
        } else {
          setError(data.error || 'Demo campaign not found')
        }
      } catch (e) {
        setError((e as Error).message)
      }
    })()
  }, [router])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary text-sm">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={28} className="animate-spin text-blue-400" />
    </div>
  )
}
