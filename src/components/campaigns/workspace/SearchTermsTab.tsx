'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { categoryTagColor, stageLabel } from '@/lib/utils';
import { useRole } from '@/components/layout/Shell';

interface SearchTerm {
  id: string; term: string; category_tag: string; why_it_helps: string;
  order_index: number; approved: boolean; notes: string | null;
}

interface Props {
  campaign: { id: string; creative_brief: string; product_category: string };
  topics: { topic: string; approved: boolean }[];
  personas: { persona_name: string }[];
  searchTerms: SearchTerm[];
  [key: string]: unknown;
}

export default function SearchTermsTab({ campaign, topics, personas, searchTerms: initialTerms }: Props) {
  const [terms, setTerms] = useState<SearchTerm[]>(initialTerms as SearchTerm[]);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

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
          personas: (personas as { persona_name: string }[]).map(p => p.persona_name),
          product_category: campaign.product_category,
          user_id: userId,
        }),
      });
      const data = await res.json();
      if (data.terms) {
        addToast('success', `Generated ${data.terms.length} search terms`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    setApproving(true);
    try {
      const res = await fetch('/api/campaigns/search-terms/approve-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, user_id: userId }),
      });
      if (res.ok) {
        addToast('success', 'All terms approved');
        router.refresh();
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
        <span>Generate exactly 15 YouTube search terms from campaign context. Only approved terms are used in creator discovery.</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? (
              <span className="flex items-center gap-1.5"><span className="animate-spin">â³</span> Generatingâ¦</span>
            ) : (
              'â¨ Generate 15 Terms (AI)'
            )}
          </button>
          {terms.length > 0 && (
            <button onClick={handleApproveAll} disabled={approving} className="btn-secondary">
              â Approve All
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {terms.length} terms Â· {approvedCount} approved
          {terms.length > 0 && terms.length !== 15 && (
            <span className="text-orange-600 ml-2">â  Expected 15</span>
          )}
        </div>
      </div>

      {/* Terms table */}
      {terms.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">ð</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No search terms yet</h3>
          <p className="text-xs text-gray-500 mb-4">Generate 15 YouTube search terms from your campaign context.</p>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? 'Generatingâ¦' : 'â¨ Generate 15 Terms'}
          </button>
        </div>
      ) : (
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
                    <td className="text-gray-400 font-mono text-xs">{term.order_index || i + 1}</td>
                    <td className="font-medium text-gray-900 font-mono text-xs">{term.term}</td>
                    <td>
                      <span className={`badge text-xs ${categoryTagColor(term.category_tag)}`}>
                        {term.category_tag.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-gray-600 text-xs max-w-xs">{term.why_it_helps}</td>
                    <td>
                      <span className={`badge text-xs ${term.approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {term.approved ? 'â Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
