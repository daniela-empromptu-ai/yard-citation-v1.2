'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, X, Upload, Sparkles, Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/Toaster';
import { useSession } from 'next-auth/react';
import { useYouTubeQuotaGate } from '@/components/campaigns/YouTubeQuotaGate';

interface Props {
  campaign: {
    id: string; name: string; stage: string;
    creative_brief: string; gumshoe_notes: string | null;
    personas: string[]; client_name: string; product_category?: string;
  };
  topics: { id: string; topic: string; approved: boolean }[];
  onPipelineStarted?: () => void;
  [key: string]: unknown;
}

export default function SetupTab({ campaign, topics: initialTopics, onPipelineStarted }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [brandUrl, setBrandUrl] = useState('');
  const [brief, setBrief] = useState(campaign.creative_brief || '');
  const [terms, setTerms] = useState<string[]>(
    initialTopics.map((t) => t.topic),
  );
  const [termDraft, setTermDraft] = useState('');
  const [gumshoeUrl, setGumshoeUrl] = useState(campaign.gumshoe_notes || '');
  const [reportFileName, setReportFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ytQuotaGate = useYouTubeQuotaGate();

  useEffect(() => { setBrief(campaign.creative_brief || ''); }, [campaign.creative_brief]);
  useEffect(() => { setGumshoeUrl(campaign.gumshoe_notes || ''); }, [campaign.gumshoe_notes]);

  const addTerm = () => {
    const v = termDraft.trim();
    if (!v) return;
    if (!terms.includes(v)) setTerms([...terms, v]);
    setTermDraft('');
  };

  const removeTerm = (t: string) => setTerms(terms.filter((x) => x !== t));

  const handleSuggest = async () => {
    if (!brief.trim()) {
      showToast('error', 'Add a creative brief first');
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch('/api/ai/suggest-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      if (!res.ok) {
        showToast('error', 'Could not suggest topics');
        return;
      }
      const suggestions = (await res.json()) as { topic: string }[];
      const newOnes = suggestions.map((s) => s.topic).filter((t) => !terms.includes(t));
      if (newOnes.length === 0) {
        showToast('info', 'No new suggestions');
      } else {
        setTerms([...terms, ...newOnes]);
        showToast('success', `Added ${newOnes.length} suggestion${newOnes.length === 1 ? '' : 's'}`);
      }
    } finally {
      setSuggesting(false);
    }
  };

  async function persistAll(): Promise<boolean> {
    const patchRes = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creative_brief: brief,
        gumshoe_notes: gumshoeUrl || null,
      }),
    });
    if (!patchRes.ok) {
      showToast('error', 'Failed to save campaign');
      return false;
    }
    const topicsRes = await fetch(`/api/campaigns/${campaign.id}/topics`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: terms }),
    });
    if (!topicsRes.ok) {
      showToast('error', 'Failed to save topics');
      return false;
    }
    return true;
  }

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const ok = await persistAll();
      if (ok) {
        showToast('success', 'Saved');
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async () => {
    if (terms.length === 0) {
      showToast('error', 'Add at least one topic to track');
      return;
    }
    const proceed = await ytQuotaGate.check();
    if (!proceed) return;
    setLaunching(true);
    try {
      const ok = await persistAll();
      if (!ok) return;

      // Regenerate search terms from the latest topics so Launch is idempotent.
      const genRes = await fetch('/api/ai/generate-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          brief,
          topics: terms,
          personas: campaign.personas || [],
          product_category: campaign.product_category || '',
        }),
      });
      if (!genRes.ok) {
        showToast('error', 'Failed to generate search terms');
        return;
      }

      const res = await fetch('/api/campaigns/search-terms/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, user_id: userId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast('success', 'Launching analysis…');
        if (onPipelineStarted) {
          onPipelineStarted();
        } else {
          router.replace(`/campaigns/${campaign.id}/analysis`);
          router.refresh();
        }
      } else {
        showToast('error', 'Failed to launch analysis');
      }
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="max-w-[640px] mx-auto pb-12">
      {ytQuotaGate.modal}
      <Field
        label="Brand URL"
        mock
        helper="The primary marketing site. We'll crawl it for positioning."
      >
        <input
          type="url"
          value={brandUrl}
          onChange={(e) => setBrandUrl(e.target.value)}
          placeholder="https://example.com"
          className="input-field"
        />
      </Field>

      <Field
        label="Creative brief"
        helper="What does this brand do, who is it for, what's the positioning? We use this to qualify creators and draft placements."
      >
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={6}
          className="input-field resize-y"
          style={{ height: 'auto', minHeight: 120, paddingTop: 10, paddingBottom: 10 }}
          placeholder="Tell us about the brand…"
        />
      </Field>

      <Field
        label="Topics to track"
        helper="We monitor AI answers to these prompts and their sources. Press enter to add."
        action={
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ color: 'var(--accent)' }}
          >
            {suggesting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {suggesting ? 'Suggesting…' : 'Suggest topics'}
          </button>
        }
      >
        <div
          className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-lg min-h-[40px]"
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-default)',
          }}
        >
          {terms.map((t) => (
            <span
              key={t}
              className="inline-flex items-start gap-1 px-2 py-0.5 rounded-md text-[12px] max-w-full"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                wordBreak: 'break-word',
              }}
            >
              {t}
              <button
                onClick={() => removeTerm(t)}
                className="hover:opacity-70"
                aria-label={`Remove ${t}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <input
            value={termDraft}
            onChange={(e) => setTermDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTerm();
              } else if (e.key === 'Backspace' && !termDraft && terms.length > 0) {
                setTerms(terms.slice(0, -1));
              }
            }}
            placeholder={terms.length === 0 ? 'Type a topic and press enter…' : ''}
            className="flex-1 min-w-[120px] bg-transparent text-[13px] focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </Field>

      <Field
        label="Gumshoe report URL"
        helper="Optional. Paste a Gumshoe report link — cited creators are extracted automatically during discovery."
      >
        <input
          type="url"
          value={gumshoeUrl}
          onChange={(e) => setGumshoeUrl(e.target.value)}
          placeholder="https://gumshoe.so/reports/…"
          className="input-field"
        />
      </Field>

      <Field
        label="Visibility report"
        mock
        helper="Optional. Upload an existing audit, or we'll run fresh analysis."
      >
        <div
          onClick={() => fileRef.current?.click()}
          className="rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer text-center transition-colors"
          style={{
            background: 'var(--bg-app)',
            border: '1px dashed var(--border-default)',
          }}
        >
          <Upload size={20} style={{ color: 'var(--text-muted)' }} />
          {reportFileName ? (
            <>
              <div className="text-[13px] mt-2" style={{ color: 'var(--text-primary)' }}>
                Report linked
              </div>
              <div className="text-[12px] mt-1 truncate max-w-full" style={{ color: 'var(--text-muted)' }}>
                {reportFileName}
              </div>
            </>
          ) : (
            <>
              <div className="text-[13px] mt-2" style={{ color: 'var(--text-primary)' }}>
                Drop a PDF, or click to upload
              </div>
              <div className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Otherwise we run fresh analysis on launch.
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setReportFileName(f.name);
            }}
          />
        </div>
      </Field>

      <div className="flex items-center justify-end gap-3 mt-10">
        <button
          onClick={handleSaveDraft}
          disabled={saving || launching}
          className="btn-ghost text-[13px]"
        >
          {saving ? 'Saving…' : 'Save as draft'}
        </button>
        <button
          onClick={handleLaunch}
          disabled={launching || saving}
          className="btn-primary"
        >
          {launching ? 'Launching…' : (
            <>
              Launch
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, helper, children, mock, action,
}: {
  label: string; helper: string; children: React.ReactNode; mock?: boolean; action?: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </div>
        {mock && (
          <span
            className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            mock
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="text-[12px] mb-2" style={{ color: 'var(--text-muted)' }}>
        {helper}
      </div>
      {children}
    </div>
  );
}
