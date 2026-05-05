'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus } from 'lucide-react'
import { showToast } from '@/components/ui/Toaster'
import { useSession } from 'next-auth/react'
import { PageHeader } from '@/components/ui/PageHeader'

export default function NewCampaignPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const submittingRef = useRef(false)

  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [clientId, setClientId] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then(setClients)
      .catch(() => setClients([]))
  }, [])

  const submit = async () => {
    if (submittingRef.current) return
    const finalClientId = clientId === 'new' ? 'new' : clientId
    if (!finalClientId || !name.trim()) {
      showToast('error', 'Pick a client and enter a campaign name')
      return
    }
    if (clientId === 'new' && !newClientName.trim()) {
      showToast('error', 'Enter the new client name')
      return
    }
    submittingRef.current = true
    setCreating(true)
    try {
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: finalClientId,
          new_client_name: clientId === 'new' ? newClientName.trim() : undefined,
          name: name.trim(),
          owner_user_id: session?.user?.id || '',
          language: 'English',
          creative_brief: '',
          personas: [],
          topics: [],
        }),
      })
      const data = await res.json()
      if (data.campaign_id) {
        router.replace(`/campaigns/${data.campaign_id}/setup`)
      } else {
        showToast('error', `Failed to create: ${data.error || 'Unknown error'}`)
      }
    } catch (e) {
      showToast('error', `Error: ${(e as Error).message}`)
    } finally {
      submittingRef.current = false
      setCreating(false)
    }
  }

  return (
    <div className="max-w-[480px] mx-auto pb-12">
      <PageHeader
        eyebrow="New campaign"
        title="Start a campaign"
        subtitle="Pick the client and give the campaign a name. You'll set the brief and topics on the next step."
      />

      <div className="mb-6">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Client
        </div>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="select-field"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ Create new client</option>
        </select>
        {clientId === 'new' && (
          <input
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            placeholder="New client name"
            className="input-field mt-2"
          />
        )}
      </div>

      <div className="mb-6">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Campaign name
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q3 visibility push"
          className="input-field"
        />
      </div>

      <div className="flex items-center justify-end gap-3 mt-10">
        <button
          onClick={() => router.push('/campaigns')}
          className="btn-ghost text-[13px]"
          disabled={creating}
        >
          Cancel
        </button>
        <button onClick={submit} disabled={creating} className="btn-primary">
          {creating ? 'Creating…' : (
            <>
              Continue to Setup
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
