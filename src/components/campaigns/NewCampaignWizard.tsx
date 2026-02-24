'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/components/layout/Shell';

interface Props {
  clients: { id: string; name: string }[];
  users: { id: string; name: string; role: string }[];
}

const STEPS = ['Basics', 'Creative Brief', 'Personas + Topics', 'Prompt Gaps + Citations'];

const GEO_OPTIONS = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia', 'India', 'Singapore', 'Netherlands', 'Sweden'];

export default function NewCampaignWizard({ clients, users }: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Step 1
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [newClientName, setNewClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [geoTargets, setGeoTargets] = useState<string[]>([]);
  const [geoInput, setGeoInput] = useState('');
  const [language, setLanguage] = useState('English');
  const [productCategory, setProductCategory] = useState('');

  // Step 2
  const [brief, setBrief] = useState('');

  // Step 3
  const [personas, setPersonas] = useState<string[]>([]);
  const [personaInput, setPersonaInput] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [aiTopics, setAiTopics] = useState<{ topic: string; confidence: number; rationale: string; approved?: boolean }[]>([]);

  // Step 4
  const [gaps, setGaps] = useState<{ prompt_text: string; priority: string; persona: string; status: string }[]>([]);
  const [gapInput, setGapInput] = useState('');

  const [createdId, setCreatedId] = useState<string | null>(null);

  const addGeo = (geo: string) => {
    if (geo && !geoTargets.includes(geo)) {
      setGeoTargets([...geoTargets, geo]);
    }
    setGeoInput('');
  };

  const suggestTopics = async () => {
    if (!brief) { addToast('warning', 'Enter a creative brief first'); return; }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (data.topics) setAiTopics(data.topics);
      else addToast('error', data.error || 'Failed to suggest topics');
    } finally {
      setAiLoading(false);
    }
  };

  const createCampaign = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/campaigns/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId, new_client_name: newClientName,
          name: campaignName, geo_targets: geoTargets, language, product_category: productCategory,
          creative_brief: brief, owner_user_id: userId,
          personas, topics: [...topics, ...aiTopics.filter(t => t.approved).map(t => t.topic)],
          prompt_gaps: gaps,
        }),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        addToast('error', `Server error (${res.status})`);
        return;
      }
      if (data.campaign_id) {
        setCreatedId(data.campaign_id);
        addToast('success', 'Campaign created!');
        router.push(`/campaigns/${data.campaign_id}`);
      } else {
        addToast('error', data.error || 'Failed to create campaign');
      }
    } catch (e) {
      addToast('error', (e as Error).message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Progress indicator */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              i === step ? 'bg-accent text-white' :
              i < step ? 'bg-accent-light text-accent' : 'bg-gray-100 text-gray-500'
            }`}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                border border-current">{i + 1}</span>
              {s}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 ${i < step ? 'bg-accent' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Basics */}
      {step === 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Campaign Basics</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Client</label>
              <select className="select-field" value={clientId} onChange={e => setClientId(e.target.value)}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="new">+ Create new clientâ¦</option>
              </select>
            </div>
            {clientId === 'new' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New Client Name</label>
                <input className="input-field" value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="Client name" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Campaign Name</label>
              <input className="input-field" value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. CloudForge â Kubernetes Cost Optimization (US + UK)" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Language</label>
              <select className="select-field" value={language} onChange={e => setLanguage(e.target.value)}>
                {['English', 'German', 'French', 'Spanish', 'Portuguese', 'Dutch', 'Mandarin'].map(l => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Category</label>
              <input className="input-field" value={productCategory} onChange={e => setProductCategory(e.target.value)} placeholder="e.g. FinOps / Kubernetes cost optimization" />
            </div>
          </div>

          {/* GEO targets */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">GEO Targets</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {geoTargets.map(g => (
                <span key={g} className="badge bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                  {g}
                  <button onClick={() => setGeoTargets(geoTargets.filter(x => x !== g))} className="hover:text-red-500">Ã</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <select className="select-field max-w-xs" value="" onChange={e => { if (e.target.value) addGeo(e.target.value); }}>
                <option value="">Select regionâ¦</option>
                {GEO_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input className="input-field max-w-xs" value={geoInput} onChange={e => setGeoInput(e.target.value)} placeholder="Or type customâ¦"
                onKeyDown={e => { if (e.key === 'Enter') addGeo(geoInput); }} />
              <button className="btn-secondary" onClick={() => addGeo(geoInput)}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Brief */}
      {step === 1 && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Creative Brief</h2>
            <p className="text-xs text-gray-500">This brief provides context for topic extraction and creator fit.</p>
          </div>
          <textarea
            className="input-field font-mono text-xs h-80 resize-none"
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="Paste your creative brief here (markdown supported)..."
          />
          <p className="text-xs text-gray-400">{brief.length} characters</p>
        </div>
      )}

      {/* Step 3: Personas + Topics */}
      {step === 2 && (
        <div className="card p-6 space-y-6">
          <h2 className="text-base font-semibold text-gray-900">Personas + Topics</h2>

          {/* Personas */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Target Personas</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {personas.map(p => (
                <span key={p} className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs flex items-center gap-1">
                  {p}
                  <button onClick={() => setPersonas(personas.filter(x => x !== p))} className="hover:text-red-500">Ã</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input-field max-w-sm" value={personaInput} onChange={e => setPersonaInput(e.target.value)}
                placeholder="e.g. Platform Engineer"
                onKeyDown={e => {
                  if (e.key === 'Enter' && personaInput.trim()) {
                    setPersonas([...personas, personaInput.trim()]);
                    setPersonaInput('');
                  }
                }} />
              <button className="btn-secondary" onClick={() => {
                if (personaInput.trim()) { setPersonas([...personas, personaInput.trim()]); setPersonaInput(''); }
              }}>Add</button>
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Campaign Topics</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {topics.map(tp => (
                <span key={tp} className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs flex items-center gap-1">
                  {tp}
                  <button onClick={() => setTopics(topics.filter(x => x !== tp))} className="hover:text-red-500">Ã</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input className="input-field max-w-sm" value={topicInput} onChange={e => setTopicInput(e.target.value)}
                placeholder="e.g. Kubernetes cost optimization"
                onKeyDown={e => {
                  if (e.key === 'Enter' && topicInput.trim()) {
                    setTopics([...topics, topicInput.trim()]);
                    setTopicInput('');
                  }
                }} />
              <button className="btn-secondary" onClick={() => {
                if (topicInput.trim()) { setTopics([...topics, topicInput.trim()]); setTopicInput(''); }
              }}>Add</button>
              <button className="btn-primary" onClick={suggestTopics} disabled={aiLoading}>
                {aiLoading ? 'â¦' : 'â¨ Suggest Topics (AI)'}
              </button>
            </div>

            {/* AI Topic suggestions */}
            {aiTopics.length > 0 && (
              <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/50 space-y-2">
                <p className="text-xs font-medium text-blue-700">AI-Suggested Topics â review and approve:</p>
                {aiTopics.map((at, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white rounded border border-gray-200 p-2">
                    <input type="checkbox" className="mt-0.5 rounded"
                      checked={!!(at as {approved?: boolean}).approved}
                      onChange={e => {
                        const updated = [...aiTopics];
                        (updated[i] as {approved?: boolean}).approved = e.target.checked;
                        setAiTopics(updated);
                      }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">{at.topic}</p>
                      <p className="text-xs text-gray-500">{at.rationale}</p>
                    </div>
                    <span className="text-xs text-gray-400">{Math.round(at.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Prompt Gaps + Citations */}
      {step === 3 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Prompt Gaps + Citations</h2>
          <p className="text-xs text-gray-500">Add the questions/gaps this campaign should address.</p>

          <div className="flex gap-2">
            <input className="input-field flex-1" value={gapInput} onChange={e => setGapInput(e.target.value)}
              placeholder="e.g. How do I reduce Kubernetes spend without breaking SLOs?" />
            <button className="btn-secondary" onClick={() => {
              if (gapInput.trim()) {
                setGaps([...gaps, { prompt_text: gapInput.trim(), priority: 'medium', persona: '', status: 'draft' }]);
                setGapInput('');
              }
            }}>Add Gap</button>
          </div>

          {gaps.length > 0 ? (
            <div className="space-y-2">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2">
                  <div className="flex-1 text-sm text-gray-800">{g.prompt_text}</div>
                  <select className="select-field w-24 text-xs" value={g.priority} onChange={e => {
                    const updated = [...gaps]; updated[i] = { ...updated[i], priority: e.target.value }; setGaps(updated);
                  }}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setGaps(gaps.filter((_, j) => j !== i))}>Ã</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No prompt gaps added yet. You can add them after creation too.</p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          className="btn-secondary"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          â Back
        </button>

        <div className="flex items-center gap-2">
          {step < STEPS.length - 1 ? (
            <button
              className="btn-primary"
              onClick={() => {
                if (step === 0 && !campaignName) { addToast('warning', 'Campaign name is required'); return; }
                if (step === 0 && !clientId) { addToast('warning', 'Select a client'); return; }
                setStep(step + 1);
              }}
            >
              Next â
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={createCampaign}
              disabled={loading || !campaignName}
            >
              {loading ? 'Creatingâ¦' : 'â Create Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
