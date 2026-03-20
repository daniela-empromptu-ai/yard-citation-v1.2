'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'

export default function DemoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const setup = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/demo/setup', { method: 'POST' })
      const data = await res.json()
      if (data.campaign_id) {
        router.push(`/campaigns/${data.campaign_id}/engage`)
      } else {
        setError(data.error || 'Failed to set up demo')
        setLoading(false)
      }
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  const reset = async () => {
    setLoading(true)
    setError(null)
    try {
      await fetch('/api/demo/setup', { method: 'DELETE' })
      await setup()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (window.location.search.includes('reset')) {
      reset()
    } else {
      setup()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {loading && !error ? (
          <>
            <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-300">Setting up your demo...</p>
          </>
        ) : error ? (
          <>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <div className="flex items-center gap-2 justify-center">
              <button onClick={setup} className="btn-primary">Retry</button>
              <button onClick={reset} className="btn-secondary flex items-center gap-1.5">
                <RotateCcw size={13} /> Reset & Retry
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
