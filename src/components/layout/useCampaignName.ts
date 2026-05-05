'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'

interface CampaignMeta { name: string; stage: string }
const cache = new Map<string, CampaignMeta>()

export function useCampaignName(): { id: string | null; name: string | null; stage: string | null } {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const id = pathname.startsWith('/campaigns/') && params?.id ? params.id : null
  const cached = id ? cache.get(id) ?? null : null
  const [meta, setMeta] = useState<CampaignMeta | null>(cached)

  useEffect(() => {
    if (!id) { setMeta(null); return }
    if (cache.has(id)) { setMeta(cache.get(id)!); return }
    let cancelled = false
    fetch(`/api/campaigns/${id}`)
      .then((r) => r.json())
      .then((data) => {
        const n = data?.campaign?.name || data?.name
        const s = data?.campaign?.stage || data?.stage
        if (!cancelled && n) {
          const m: CampaignMeta = { name: n, stage: s || 'setup' }
          cache.set(id, m)
          setMeta(m)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [id])

  return { id, name: meta?.name ?? null, stage: meta?.stage ?? null }
}
