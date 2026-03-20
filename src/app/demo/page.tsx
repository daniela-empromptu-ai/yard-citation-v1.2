'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'

export default function DemoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)

  const setup = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/demo/setup', { method: 'POST' })
      const data = await res.json()
      if (data.campaign_id) {
        router.push(`/campaigns/${data.campaign_id}/search-terms`)
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
    setResetting(true)
    try {
      await fetch('/api/demo/setup', { method: 'DELETE' })
      await setup()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setResetting(false)
    }
  }

  useEffect(() => { setup() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {loading && !error ? (
          <>
            <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-300">
              {resetting ? 'Resetting demo...' : 'Setting up your demo...'}
            </p>
            <p className="text-xs text-slate-500 mt-1">This takes a few seconds.</p>
          </>
        ) : error ? (
          <>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <div className="flex items-center gap-2 justify-center">
              <button onClick={setup} disabled={loading} className="btn-primary">Retry</button>
              <button onClick={reset} disabled={resetting} className="btn-secondary flex items-center gap-1.5">
                <RotateCcw size={13} /> Reset & Retry
              </button>
            </div>
          </>
        ) : null}

        {/* Reset button always visible at bottom */}
        {!error && !loading && (
          <button onClick={reset} disabled={resetting} className="btn-ghost text-xs mt-8 flex items-center gap-1.5 mx-auto">
            <RotateCcw size={12} /> Reset Demo
          </button>
        )}
      </div>
    </div>
  )
}
