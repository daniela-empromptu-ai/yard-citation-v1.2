'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { categoryTagColor } from '@/lib/utils';
import { useRole } from '@/components/layout/Shell';
import { EmptyState } from '@/components/ui/EmptyState';

interface SearchTerm {
  id: string; term: string; category_tag: string; why_it_helps: string;
  order_index: number; approved: boolean; notes: string | null;
}

interface Props {
  campaign: { id: string; creative_brief: string; product_category: string; stage: string; personas: string[] };
  topics: { topic: string; approved: boolean }[];
  searchTerms: SearchTerm[];
  onPipelineStarted?: () => void;
  onTermsUpdated?: (terms: SearchTerm[]) => void;
  [key: string]: unknown;
}

export default function SearchTermsTab({ campaign, topics, searchTerms: initialTerms, onPipelineStarted, onTermsUpdated }: Props) {
  const [terms, setTerms] = useState<SearchTerm[]>(initialTerms as SearchTerm[]);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [polling, setPolling] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  const pollForTerms = useCallback(async () => {
    if (terms.length > 0 || polling) return;
    if (campaign.stage !== 'draft' && campaign.stage !== 'terms') return;

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
            setPolling(false);
            return;
          }
        }
      } catch { /* ignore */ }
      if (attempts >= 12) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [campaign.id, campaign.stage, terms.length, polling, onTermsUpdated]);

  useEffect(() => {
    if (terms.length === 0 && (campaign.stage === 'draft' || campaign.stage === 'terms')) {
      pollForTerms();
    }
  }, [terms.length, campaign.stage, pollForTerms]);

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
        addToast('success', `Generated ${newTerms.length} search terms`);
        const refreshRes = await fetch(`/api/campaigns/${campaign.id}/search-terms`);
        if (refreshRes.ok) {
          const freshTerms = await refreshRes.json();
          const arr = Array.isArray(freshTerms) ? freshTerms : freshTerms.terms;
          if (arr?.length > 0) {
            setTerms(arr);
            onTermsUpdated?.(arr);
          }
        }
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndRun = async () => {
    setApproving(true);
    try {
      const res = await fetch('/api/campaigns/search-terms/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, user_id: userId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        addToast('success', 'Terms approved — finding creators…');
        setTerms(prev => prev.map(t => ({ ...t, approved: true })));
        onPipelineStarted?.();
      } else {
        addToast('error', 'Failed to approve terms');
      }
    } finally {
      setApproving(false);
    }
  };

  const approvedCount = terms.filter(t => t.approved).length;

  return (
    <div className="space-y-4">
      {/* Notice */}
      <div className="notice-box">
        <span>Generate exactly 15 YouTube search terms from campaign context. Approving triggers the full creator discovery pipeline.</span>
      </div>

      {/* Loading state while terms generate */}
      {polling && terms.length === 0 && (
        <div className="card p-6 text-center">
          <div className="animate-spin text-2xl mb-3">{'\u27F3'}</div>
          <p className="text-sm font-medium text-slate-300">Generating search terms from your campaign brief…</p>
          <p className="text-xs text-slate-500 mt-1">This typically takes 10-20 seconds.</p>
        </div>
      )}

      {/* Actions */}
      {(!polling || terms.length > 0) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={handleGenerate} disabled={generating} className="btn-primary">
              {generating ? (
                <span className="flex items-center gap-1.5"><span className="animate-spin">{'\u27F3'}</span> Generating…</span>
              ) : (
                'Generate 15 Terms (AI)'
              )}
            </button>
            {terms.length > 0 && approvedCount < terms.length && (
              <button onClick={handleApproveAndRun} disabled={approving} className="btn-primary bg-green-600 hover:bg-green-700">
                {approving ? (
                  <span className="flex items-center gap-1.5"><span className="animate-spin">{'\u27F3'}</span> Starting…</span>
                ) : (
                  'Approve All & Find Creators'
                )}
              </button>
            )}
            {terms.length > 0 && approvedCount === terms.length && (
              <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                All terms approved
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500">
            {terms.length} terms · {approvedCount} approved
            {terms.length > 0 && terms.length !== 15 && (
              <span className="text-orange-400 ml-2">Expected 15</span>
            )}
          </div>
        </div>
      )}

      {/* Terms table */}
      {terms.length === 0 && !polling ? (
        <div className="card">
          <EmptyState
            icon=""
            title="No search terms yet"
            description="Generate 15 YouTube search terms from your campaign context."
            action={{ label: 'Generate 15 Terms', onClick: handleGenerate, loading: generating }}
          />
        </div>
      ) : terms.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Search Term</th>
                  <th>Category Tag</th>
                  <th>Why it Helps</th>
                  <th className="w-20">Approved</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term, i) => (
                  <tr key={term.id}>
                    <td className="text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="font-medium text-slate-200 font-mono text-xs">{term.term}</td>
                    <td>
                      <span className={`badge text-xs ${categoryTagColor(term.category_tag)}`}>
                        {term.category_tag.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs max-w-xs">{term.why_it_helps}</td>
                    <td>
                      <span className={`badge text-xs ${term.approved ? 'bg-green-900/30 text-green-400 border-green-700/50' : 'bg-slate-800/50 text-slate-500 border-slate-600/50'}`}>
                        {term.approved ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
