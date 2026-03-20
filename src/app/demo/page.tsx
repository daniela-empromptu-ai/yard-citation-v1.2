'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function DemoPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const setup = async () => {
    setError(null)
    setRetrying(true)
    try {
      const res = await fetch('/api/demo/setup', { method: 'POST' })
      const data = await res.json()
      if (data.campaign_id) {
        router.push(`/campaigns/${data.campaign_id}/search-terms`)
      } else {
        setError(data.error || 'Failed to set up demo')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRetrying(false)
    }
  }

  useEffect(() => { setup() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button onClick={setup} disabled={retrying} className="btn-primary">
              {retrying ? 'Retrying...' : 'Retry Setup'}
            </button>
          </>
        ) : (
          <>
            <Loader2 size={32} className="animate-spin text-blue-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-300">Setting up your demo...</p>
            <p className="text-xs text-slate-500 mt-1">This takes a few seconds.</p>
          </>
        )}
      </div>
    </div>
  )
}
