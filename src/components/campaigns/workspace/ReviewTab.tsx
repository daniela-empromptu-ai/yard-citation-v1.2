'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag } from '@/components/ui/Badge';
import { stageLabel, pipelineStageColor } from '@/lib/utils';
import { useRole } from '@/components/layout/Shell';

interface CC {
  id: string; creator_id: string; creator_name: string; pipeline_stage: string;
  overall_score: number | null; evidence_coverage: string | null; needs_manual_review: boolean | null;
  scoring_status: string;
}

interface Props {
  campaign: { id: string };
  campaignCreators: CC[];
  [key: string]: unknown;
}

export default function ReviewTab({ campaign, campaignCreators }: Props) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [overrideScore, setOverrideScore] = useState<Record<string, string>>({});
  const router = useRouter();
  const { addToast } = useToast();
  const { userId, role } = useRole();

  const scoredCreators = (campaignCreators as CC[]).filter(cc =>
    ['scored', 'needs_manual_review', 'approved', 'outreach_ready'].includes(cc.pipeline_stage)
  );

  const submitReview = async (cc: CC, decision: string) => {
    setSubmitting(cc.id);
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_creator_id: cc.id,
          user_id: userId,
          decision,
          notes_md: notes[cc.id] || null,
          manual_override_score: overrideScore[cc.id] ? Number(overrideScore[cc.id]) : null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Review submitted: ${decision.replace(/_/g, ' ')}`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Review failed');
      }
    } finally {
      setSubmitting(null);
    }
  };

  if (role !== 'qualifier' && role !== 'admin') {
    return (
      <div className="card text-center py-16">
        <div className="text-4xl mb-3">ð</div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Qualifier Role Required</h3>
        <p className="text-xs text-gray-500">Switch to Qualifier role to review creators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="notice-box">
        <span>Assistive only â human approval required before outreach. Review scored creators and approve, reject, or flag for manual review.</span>
      </div>

      {scoredCreators.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">ð</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No creators ready for review</h3>
          <p className="text-xs text-gray-500">Score creators first, then they will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {scoredCreators.map(cc => (
            <div key={cc.id} className={`card p-4 ${cc.needs_manual_review ? 'border-orange-200 bg-orange-50/30' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">{cc.creator_name}</h3>
                    <span className={`badge text-xs ${pipelineStageColor(cc.pipeline_stage)}`}>
                      {stageLabel(cc.pipeline_stage)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Score:</span>
                      <ScorePill score={cc.overall_score} showBar />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Evidence:</span>
                      <CoverageTag coverage={cc.evidence_coverage || 'none'} />
                    </div>
                    {cc.needs_manual_review && (
                      <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">â  Needs Manual Review</span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 space-y-2 w-64">
                  {/* Override score */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 flex-shrink-0">Override score:</label>
                    <input
                      type="number" min="0" max="100"
                      className="input-field w-20 text-xs py-1"
                      value={overrideScore[cc.id] || ''}
                      onChange={e => setOverrideScore({...overrideScore, [cc.id]: e.target.value})}
                      placeholder="â"
                    />
                  </div>
                  {/* Notes */}
                  <textarea
                    className="input-field text-xs h-14 resize-none"
                    value={notes[cc.id] || ''}
                    onChange={e => setNotes({...notes, [cc.id]: e.target.value})}
                    placeholder="Review notes (optional)â¦"
                  />
                  {/* Decision buttons */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => submitReview(cc, 'approved_for_outreach')}
                      disabled={submitting === cc.id}
                      className="btn-primary text-xs py-1 flex-1"
                    >
                      â Approve
                    </button>
                    <button
                      onClick={() => submitReview(cc, 'needs_manual_review')}
                      disabled={submitting === cc.id}
                      className="btn-secondary text-xs py-1"
                    >
                      â  NMR
                    </button>
                    <button
                      onClick={() => submitReview(cc, 'rejected')}
                      disabled={submitting === cc.id}
                      className="btn-danger text-xs py-1"
                    >
                      Ã Reject
                    </button>
                    <button
                      onClick={() => submitReview(cc, 'excluded')}
                      disabled={submitting === cc.id}
                      className="btn-ghost text-xs py-1 text-gray-500"
                    >
                      Exclude
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
