'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Plus, X, Sparkles, Loader2 } from 'lucide-react'
import { showToast } from '@/components/ui/Toaster'

const STEPS = ['Basics', 'Creative Brief', 'Personas & Topics', 'Prompt Gaps & Citations']

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [clients, setClients] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(false)
  const [suggestingTopics, setSuggestingTopics] = useState(false)

  const [form, setForm] = useState({
    client_id: '',
    name: '',
    geo_targets: [] as string[],
    language: 'English',
    product_category: '',
    creative_brief: '',
    personas: [] as string[],
    topics: [] as string[],
    newGeo: '',
    newPersona: '',
    newTopic: '',
    newClientName: '',
    owner_user_id: 'a1000000-0000-0000-0000-000000000001',
  })

  const [suggestedTopics, setSuggestedTopics] = useState<{ topic: string; confidence: number; rationale: string }[]>([])

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => setClients([]))
    try {
      const u = JSON.parse(localStorage.getItem('yard_current_user') || '{}')
      if (u.id) setForm(f => ({ ...f, owner_user_id: u.id }))
    } catch { /* ignore */ }
  }, [])

  const update = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const addToArray = (key: string, valueKey: string) => {
    const val = form[valueKey as keyof typeof form] as string
    if (!val.trim()) return
    const arr = form[key as keyof typeof form] as string[]
    if (!arr.includes(val.trim())) {
      update(key, [...arr, val.trim()])
    }
    update(valueKey, '')
  }

  const removeFromArray = (key: string, val: string) => {
    const arr = form[key as keyof typeof form] as string[]
    update(key, arr.filter(x => x !== val))
  }

  const createClient = async () => {
    if (!form.newClientName.trim()) return
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.newClientName }),
    })
    const client = await res.json()
    setClients(prev => [...prev, client])
    update('client_id', client.id)
    update('newClientName', '')
  }

  const suggestTopics = async () => {
    if (!form.creative_brief.trim()) return
    setSuggestingTopics(true)
    try {
      const res = await fetch('/api/ai/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: form.creative_brief }),
      })
      const topics = await res.json()
      setSuggestedTopics(Array.isArray(topics) ? topics : [])
    } catch (e) {
      showToast('error', `Failed to suggest topics: ${(e as Error).message}`)
    }
    setSuggestingTopics(false)
  }

  const submit = async () => {
    if (!form.client_id || !form.name || !form.creative_brief) {
      showToast('error', 'Please fill in all required fields')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: form.client_id,
          name: form.name,
          owner_user_id: form.owner_user_id,
          geo_targets: form.geo_targets,
          language: form.language,
          product_category: form.product_category,
          creative_brief: form.creative_brief,
        }),
      })
      const campaign = await res.json()
      if (campaign.id) {
        // Add personas and topics
        for (const persona of form.personas) {
          await fetch(`/api/campaigns/${campaign.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
          await fetch('/api/database/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `INSERT INTO campaign_personas (id, campaign_id, persona_name, created_at) VALUES (gen_random_uuid(),$1,$2,now()) ON CONFLICT DO NOTHING`,
              params: [campaign.id, persona],
            }),
          }).catch(() => {})
        }
        showToast('success', 'Campaign created successfully!')
        router.push(`/campaigns/${campaign.id}/overview`)
      } else {
        showToast('error', `Failed to create campaign: ${campaign.error || 'Unknown error'}`)
      }
    } catch (e) {
      showToast('error', `Error: ${(e as Error).message}`)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">New Campaign</h1>
        <p className="text-sm text-slate-500 mt-0.5">Set up a creator outreach campaign</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${i === step ? 'bg-blue-600 text-white' : i < step ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
              <span>{i < step ? 'â' : i + 1}</span>
              <span>{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* STEP 0: Basics */}
      {step === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client *</label>
            <div className="flex gap-2">
              <select
                value={form.client_id}
                onChange={e => update('client_id', e.target.value)}
                className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select clientâ¦</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                placeholder="Or create newâ¦"
                value={form.newClientName}
                onChange={e => update('newClientName', e.target.value)}
                className="w-40 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && createClient()}
              />
              <button onClick={createClient} className="px-3 h-9 bg-slate-100 hover:bg-slate-200 text-sm rounded-lg text-slate-600 font-medium">Add</button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Campaign Name *</label>
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="e.g. CloudForge â Kubernetes Cost Optimization (US)"
              className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">GEO Targets</label>
            <div className="flex gap-2 mb-2">
              <input
                value={form.newGeo}
                onChange={e => update('newGeo', e.target.value)}
                placeholder="e.g. United States"
                className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addToArray('geo_targets', 'newGeo')}
              />
              <button onClick={() => addToArray('geo_targets', 'newGeo')} className="px-3 h-9 bg-slate-100 hover:bg-slate-200 text-sm rounded-lg text-slate-600 font-medium">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.geo_targets.map(g => (
                <span key={g} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {g}
                  <button onClick={() => removeFromArray('geo_targets', g)}><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <input
                value={form.language}
                onChange={e => update('language', e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product Category</label>
              <input
                value={form.product_category}
                onChange={e => update('product_category', e.target.value)}
                placeholder="e.g. FinOps / Kubernetes"
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: Brief */}
      {step === 1 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Creative Brief * <span className="text-slate-400 font-normal">(Markdown supported)</span></label>
            <p className="text-xs text-slate-400 mb-2">This brief provides context for topic extraction and creator fit.</p>
            <textarea
              value={form.creative_brief}
              onChange={e => update('creative_brief', e.target.value)}
              placeholder="# Campaign Brief&#10;&#10;## Key message&#10;..."
              rows={16}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      )}

      {/* STEP 2: Personas + Topics */}
      {step === 2 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {/* Personas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Personas</label>
            <div className="flex gap-2 mb-2">
              <input
                value={form.newPersona}
                onChange={e => update('newPersona', e.target.value)}
                placeholder="e.g. Platform Engineer"
                className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addToArray('personas', 'newPersona')}
              />
              <button onClick={() => addToArray('personas', 'newPersona')} className="px-3 h-9 bg-slate-100 text-slate-600 text-sm rounded-lg font-medium hover:bg-slate-200">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.personas.map(p => (
                <span key={p} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  {p}
                  <button onClick={() => removeFromArray('personas', p)}><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Topics</label>
              <button
                onClick={suggestTopics}
                disabled={suggestingTopics || !form.creative_brief}
                className="flex items-center gap-1.5 px-3 h-7 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {suggestingTopics ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                Suggest topics (AI)
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                value={form.newTopic}
                onChange={e => update('newTopic', e.target.value)}
                placeholder="e.g. Kubernetes cost optimization"
                className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addToArray('topics', 'newTopic')}
              />
              <button onClick={() => addToArray('topics', 'newTopic')} className="px-3 h-9 bg-slate-100 text-slate-600 text-sm rounded-lg font-medium hover:bg-slate-200">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {form.topics.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  {t}
                  <button onClick={() => removeFromArray('topics', t)}><X size={10} /></button>
                </span>
              ))}
            </div>
            {/* AI Suggestions */}
            {suggestedTopics.length > 0 && (
              <div className="border border-purple-200 rounded-lg p-3 bg-purple-50">
                <p className="text-xs font-semibold text-purple-700 mb-2">AI Suggestions (click to add):</p>
                {suggestedTopics.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <button
                      onClick={() => {
                        if (!form.topics.includes(s.topic)) update('topics', [...form.topics, s.topic])
                        setSuggestedTopics(prev => prev.filter((_, j) => j !== i))
                      }}
                      className="shrink-0 px-2.5 py-1 bg-purple-600 text-white text-xs rounded-full hover:bg-purple-700"
                    >
                      + {s.topic}
                    </button>
                    <div>
                      <span className="text-[10px] text-purple-600 font-medium">Confidence: {Math.round(s.confidence * 100)}%</span>
                      <p className="text-[11px] text-slate-600">{s.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: Prompt Gaps */}
      {step === 3 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-sm text-slate-500 mb-4">Prompt gaps and citations can be added after campaign creation in the Brief & Inputs tab.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <strong>Ready to create your campaign?</strong> Click "Create Campaign" to proceed.
            You can add prompt gaps, citations, and search terms in the campaign workspace.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-2 px-4 h-9 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft size={14} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className="flex items-center gap-2 px-4 h-9 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 px-5 h-9 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Create Campaign
          </button>
        )}
      </div>
    </div>
  )
}
