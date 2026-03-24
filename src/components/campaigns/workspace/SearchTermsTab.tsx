'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { categoryTagColor } from '@/lib/utils';
import { useRole } from '@/components/layout/Shell';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Search } from 'lucide-react';

interface SearchTerm {
  id: string; term: string; category_tag: string; why_it_helps: string;
  order_index: number; approved: boolean; notes: string | null;
}

interface Props {
  campaign: { id: string; name?: string; creative_brief: string; product_category: string; stage: string; personas: string[] };
  topics: { topic: string; approved: boolean }[];
  searchTerms: SearchTerm[];
  pipelineRan?: boolean;
  onPipelineStarted?: () => void;
  onTermsUpdated?: (terms: SearchTerm[]) => void;
  [key: string]: unknown;
}

// ─── Toggle Switch ───

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${on ? 'bg-green-600' : 'bg-slate-700'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

// ─── Search Term Card ───

function SearchTermCard({ term, enabled, onToggle, onClick, disabled }: {
  term: SearchTerm;
  enabled: boolean;
  onToggle: () => void;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border transition-all ${
        enabled
          ? 'bg-[#1e293b] border-[#2d3748] hover:border-[#3b4a5e]'
          : 'bg-[#1e293b]/50 border-[#2d3748]/50 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer">
          <Search size={14} className="text-slate-500 shrink-0" />
          <span className="text-sm text-slate-200 font-medium truncate">{term.term}</span>
        </button>
        <span className={`badge text-[10px] shrink-0 ${categoryTagColor(term.category_tag)}`}>
          {term.category_tag.replace(/_/g, ' ')}
        </span>
        <Toggle on={enabled} onToggle={onToggle} disabled={disabled} />
      </div>
    </div>
  );
}

// ─── Main Component ───

export default function SearchTermsTab({ campaign, topics, searchTerms: initialTerms, pipelineRan, onPipelineStarted, onTermsUpdated }: Props) {
  const [terms, setTerms] = useState<SearchTerm[]>(initialTerms as SearchTerm[]);
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  const [selectedTerm, setSelectedTerm] = useState<SearchTerm | null>(null);
  const [disabledTerms, setDisabledTerms] = useState<Set<string>>(new Set());
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  // Poll for terms only when stage is draft/terms AND no terms loaded from server
  useEffect(() => {
    if (terms.length > 0 || pollingRef.current) return;
    if (campaign.stage !== 'draft' && campaign.stage !== 'terms') return;

    pollingRef.current = true;
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/campaigns/${campaign.id}/search-terms`);
        if (res.ok) {
          const data = await res.json();
          const termsArr = Array.isArray(data) ? data : data.terms;
          if (termsArr && termsArr.length > 0) {
            setTerms(termsArr);
            onTermsUpdated?.(termsArr);
            clearInterval(interval);
            pollingRef.current = false;
            setPolling(false);
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 12) {
        clearInterval(interval);
        pollingRef.current = false;
        setPolling(false);
      }
    }, 3000);

    return () => { clearInterval(interval); pollingRef.current = false; };
  }, [campaign.id, campaign.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          brief: campaign.creative_brief,
          topics: (topics as { topic: string; approved: boolean }[]).filter(t => t.approved).map(t => t.topic),
          personas: campaign.personas || [],
          product_category: campaign.product_category,
          user_id: userId,
        }),
      });
      const data = await res.json();
      const newTerms = Array.isArray(data) ? data : data.terms;
      if (newTerms && newTerms.length > 0) {
        setTerms(newTerms);
        onTermsUpdated?.(newTerms);
        addToast('success', `Generated ${newTerms.length} search terms`);
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateEngagement = async () => {
    setStarting(true);
    try {
      const endpoint = '/api/campaigns/search-terms/approve-all';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, user_id: userId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        addToast('success', 'Starting engagement discovery...');
        setTerms(prev => prev.map(t => ({ ...t, approved: true })));
        onPipelineStarted?.();
      } else {
        addToast('error', 'Failed to start engagement generation');
      }
    } finally {
      setStarting(false);
    }
  };

  const toggleTerm = (id: string) => {
    setDisabledTerms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const activeCount = terms.length - disabledTerms.size;

  return (
    <div className="space-y-5">
      {/* Loading state while terms generate */}
      {polling && terms.length === 0 && (
        <div className="card p-8 text-center">
          <div className="animate-spin text-2xl mb-3">{'\u27F3'}</div>
          <p className="text-sm font-medium text-slate-300">Generating search terms from your campaign brief...</p>
          <p className="text-xs text-slate-500 mt-1">This typically takes 10-20 seconds.</p>
        </div>
      )}

      {/* No terms yet */}
      {terms.length === 0 && !polling ? (
        <div className="card">
          <EmptyState
            icon=""
            title="No search terms yet"
            description="Generate search terms from your campaign context to start finding creators."
            action={{ label: 'Generate Search Terms', onClick: handleGenerate, loading: generating }}
          />
        </div>
      ) : terms.length > 0 ? (
        <>
          {/* Header */}
          <div className="text-center pb-2">
            <h2 className="text-base font-semibold text-slate-200">
              Search terms to discover creators for your brand
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Click any term for details. Toggle off terms you don't want included.
            </p>
          </div>

          {/* Term cards — 2 column grid */}
          <div className="grid grid-cols-2 gap-3">
            {terms.map(term => (
              <SearchTermCard
                key={term.id}
                term={term}
                enabled={!disabledTerms.has(term.id)}
                onToggle={() => toggleTerm(term.id)}
                onClick={() => setSelectedTerm(term)}
                disabled={pipelineRan}
              />
            ))}
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              {activeCount} of {terms.length} terms active
            </span>
            {!pipelineRan ? (
              <button
                onClick={handleGenerateEngagement}
                disabled={starting || activeCount === 0}
                className="btn-primary px-6"
              >
                {starting ? (
                  <span className="flex items-center gap-1.5"><span className="animate-spin">{'\u27F3'}</span> Starting...</span>
                ) : (
                  'Generate Engagement Leads'
                )}
              </button>
            ) : (
              <span className="text-xs text-green-400 font-medium">Engagement generated</span>
            )}
          </div>
        </>
      ) : null}

      {/* Term detail modal */}
      <Modal open={selectedTerm !== null} onClose={() => setSelectedTerm(null)} title={selectedTerm?.term || ''} size="md">
        {selectedTerm && (
          <div className="space-y-4">
            <div>
              <span className={`badge text-xs ${categoryTagColor(selectedTerm.category_tag)}`}>
                {selectedTerm.category_tag.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Why it helps</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{selectedTerm.why_it_helps}</p>
            </div>
            {selectedTerm.notes && (
              <div>
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notes</h4>
                <p className="text-sm text-slate-400">{selectedTerm.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
