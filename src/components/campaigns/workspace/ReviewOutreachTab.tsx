'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag, OutreachBadge } from '@/components/ui/Badge';
import { pipelineStageColor, stageLabel, formatDate } from '@/lib/utils';
import Drawer from '@/components/ui/Drawer';
import ReactMarkdown from 'react-markdown';
import { useRole } from '@/components/layout/Shell';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ───

interface CC {
  id: string; creator_id: string; creator_name: string; pipeline_stage: string;
  overall_score: number | null; evidence_coverage: string | null; needs_manual_review: boolean | null;
  scoring_status: string; outreach_state: string; next_followup_due_at: string | null;
  owner_name: string | null;
}

interface OutreachPacket {
  subject: string; body_md: string;
  followup_plan_json: { channel: string; day: number; action: string; done: boolean }[];
}

interface Props {
  campaign: { id: string };
  campaignCreators: CC[];
  [key: string]: unknown;
}

const OUTREACH_STATES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'drafted', label: 'Drafted' },
  { value: 'copied', label: 'Copied' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'booked', label: 'Booked' },
];

export default function ReviewOutreachTab({ campaign, campaignCreators }: Props) {
  const [selectedCcId, setSelectedCcId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [overrideScore, setOverrideScore] = useState<Record<string, string>>({});
  const [packet, setPacket] = useState<OutreachPacket | null>(null);
  const [loadingPacket, setLoadingPacket] = useState(false);
  const [generatingPacket, setGeneratingPacket] = useState<string | null>(null);
  const [updatingState, setUpdatingState] = useState<string | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null);
  const router = useRouter();
  const { addToast } = useToast();
  const { userId, role } = useRole();

  const eligibleCreators = (campaignCreators as CC[]).filter(cc =>
    ['scored', 'needs_manual_review', 'approved', 'outreach_ready', 'contacted', 'booked'].includes(cc.pipeline_stage) ||
    cc.outreach_state !== 'not_started'
  );

  const selectedCc = eligibleCreators.find(cc => cc.id === selectedCcId) || null;
  const isQualifier = role === 'qualifier' || role === 'admin';
  const isOutreachEligible = selectedCc && ['outreach_ready', 'contacted', 'booked', 'approved'].includes(selectedCc.pipeline_stage);

  // ─── Actions ───

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
        addToast('success', `Review: ${decision.replace(/_/g, ' ')}`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Review failed');
      }
    } finally {
      setSubmitting(null);
    }
  };

  const loadPacket = async (cc: CC) => {
    setLoadingPacket(true);
    setPacket(null);
    try {
      const res = await fetch(`/api/outreach-packets/${cc.id}`);
      const data = await res.json();
      setPacket(data.packet || null);
    } finally {
      setLoadingPacket(false);
    }
  };

  const generatePacket = async (cc: CC) => {
    setGeneratingPacket(cc.id);
    try {
      const res = await fetch('/api/ai/outreach-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_creator_id: cc.id, user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Outreach packet generated');
        await loadPacket(cc);
        router.refresh();
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } finally {
      setGeneratingPacket(null);
    }
  };

  const updateState = async (cc: CC, newState: string) => {
    setUpdatingState(cc.id);
    try {
      const res = await fetch('/api/outreach/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_creator_id: cc.id, state: newState, user_id: userId }),
      });
      if (res.ok) {
        addToast('success', `State updated to ${newState}`);
        router.refresh();
      }
    } finally {
      setUpdatingState(null);
    }
  };

  const copyText = (text: string, type: 'subject' | 'body' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    addToast('info', 'Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSelectCreator = (cc: CC) => {
    setSelectedCcId(cc.id);
    setPacket(null);
    if (['outreach_ready', 'contacted', 'booked', 'approved'].includes(cc.pipeline_stage)) {
      loadPacket(cc);
    }
  };

  if (eligibleCreators.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon=""
          title="No creators ready for review"
          description="Score creators first — they will appear here once evaluated."
        />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Left panel — Creator list */}
      <div className="w-72 flex-shrink-0 card overflow-y-auto">
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 sticky top-0">
          <span className="text-xs font-medium text-gray-600">{eligibleCreators.length} creators</span>
        </div>
        <div className="divide-y divide-gray-100">
          {eligibleCreators.map(cc => (
            <button
              key={cc.id}
              onClick={() => handleSelectCreator(cc)}
              className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selectedCcId === cc.id ? 'bg-blue-50 border-l-2 border-l-accent' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 truncate">{cc.creator_name}</span>
                <ScorePill score={cc.overall_score} />
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`badge text-xs ${pipelineStageColor(cc.pipeline_stage)}`}>
                  {stageLabel(cc.pipeline_stage)}
                </span>
                {cc.outreach_state !== 'not_started' && (
                  <OutreachBadge state={cc.outreach_state} />
                )}
                {cc.needs_manual_review && (
                  <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">NMR</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — Selected creator detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedCc ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Select a creator to review</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{selectedCc.creator_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge text-xs ${pipelineStageColor(selectedCc.pipeline_stage)}`}>
                      {stageLabel(selectedCc.pipeline_stage)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Score:</span>
                      <ScorePill score={selectedCc.overall_score} showBar />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Evidence:</span>
                      <CoverageTag coverage={selectedCc.evidence_coverage || 'none'} />
                    </div>
                    {selectedCc.needs_manual_review && (
                      <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">{'\u26A0'} Needs Manual Review</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Review Section (qualifier/admin only) */}
            {isQualifier && ['scored', 'needs_manual_review'].includes(selectedCc.pipeline_stage) && (
              <div className={`card p-4 ${selectedCc.needs_manual_review ? 'border-orange-200 bg-orange-50/30' : ''}`}>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Review Decision</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 flex-shrink-0">Override score:</label>
                    <input
                      type="number" min="0" max="100"
                      className="input-field w-20 text-xs py-1"
                      value={overrideScore[selectedCc.id] || ''}
                      onChange={e => setOverrideScore({ ...overrideScore, [selectedCc.id]: e.target.value })}
                      placeholder="—"
                    />
                  </div>
                  <textarea
                    className="input-field text-xs h-14 resize-none w-full"
                    value={notes[selectedCc.id] || ''}
                    onChange={e => setNotes({ ...notes, [selectedCc.id]: e.target.value })}
                    placeholder="Review notes (optional)…"
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => submitReview(selectedCc, 'approved_for_outreach')}
                      disabled={submitting === selectedCc.id}
                      className="btn-primary text-xs py-1.5 flex-1"
                    >
                      {'\u2713'} Approve
                    </button>
                    <button
                      onClick={() => submitReview(selectedCc, 'needs_manual_review')}
                      disabled={submitting === selectedCc.id}
                      className="btn-secondary text-xs py-1.5"
                    >
                      {'\u26A0'} NMR
                    </button>
                    <button
                      onClick={() => submitReview(selectedCc, 'rejected')}
                      disabled={submitting === selectedCc.id}
                      className="btn-danger text-xs py-1.5"
                    >
                      {'\u00D7'} Reject
                    </button>
                    <button
                      onClick={() => submitReview(selectedCc, 'excluded')}
                      disabled={submitting === selectedCc.id}
                      className="btn-ghost text-xs py-1.5 text-gray-500"
                    >
                      Exclude
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Outreach Section */}
            {isOutreachEligible && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Outreach</h4>
                  <div className="flex items-center gap-2">
                    <OutreachBadge state={selectedCc.outreach_state} />
                    <select
                      className="select-field text-xs py-0.5 px-1 w-28"
                      value={selectedCc.outreach_state}
                      onChange={e => updateState(selectedCc, e.target.value)}
                      disabled={updatingState === selectedCc.id}
                    >
                      {OUTREACH_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mb-3 flex items-center gap-2">
                  <span className="text-amber-600 text-sm">{'\u26A0\uFE0F'}</span>
                  <p className="text-xs text-amber-700 font-medium">This tool does not send emails. Copy the draft and send manually.</p>
                </div>

                {loadingPacket ? (
                  <div className="flex items-center justify-center h-16 text-gray-400">
                    <div className="animate-spin text-xl">{'\u27F3'}</div>
                  </div>
                ) : !packet ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500 mb-2">No outreach packet yet.</p>
                    <button
                      onClick={() => generatePacket(selectedCc)}
                      disabled={generatingPacket === selectedCc.id}
                      className="btn-primary text-xs"
                    >
                      {generatingPacket === selectedCc.id ? 'Generating\u2026' : 'Generate Outreach Draft'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Subject */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-700">Subject Line</label>
                        <button onClick={() => copyText(packet.subject, 'subject')} className="btn-ghost text-xs py-0.5 px-2">
                          {copied === 'subject' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="bg-gray-50 rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200">
                        {packet.subject}
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-700">Email Body</label>
                        <div className="flex gap-1">
                          <button onClick={() => copyText(packet.body_md, 'body')} className="btn-ghost text-xs py-0.5 px-2">
                            {copied === 'body' ? 'Copied' : 'Copy Body'}
                          </button>
                          <button
                            onClick={() => copyText(`Subject: ${packet.subject}\n\n${packet.body_md}`, 'all')}
                            className="btn-primary text-xs py-0.5 px-2"
                          >
                            {copied === 'all' ? 'Copied!' : 'Copy Full Email'}
                          </button>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-md p-4 max-h-48 overflow-y-auto prose prose-sm max-w-none">
                        <ReactMarkdown>{packet.body_md}</ReactMarkdown>
                      </div>
                    </div>

                    {/* Follow-up checklist */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-2">Follow-up Checklist</h4>
                      <div className="space-y-1">
                        {(packet.followup_plan_json || []).map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs py-1">
                            <input type="checkbox" checked={step.done} readOnly className="rounded" />
                            <span className={`badge ${
                              step.channel === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              step.channel === 'linkedin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              'bg-gray-50 text-gray-600 border-gray-200'
                            }`}>{step.channel}</span>
                            <span className="text-gray-500">Day {step.day}:</span>
                            <span className="text-gray-700">{step.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Regenerate */}
                    <button
                      onClick={() => generatePacket(selectedCc)}
                      disabled={generatingPacket === selectedCc.id}
                      className="btn-secondary text-xs w-full"
                    >
                      {generatingPacket === selectedCc.id ? 'Regenerating\u2026' : 'Regenerate Draft'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Not qualifier role warning */}
            {!isQualifier && ['scored', 'needs_manual_review'].includes(selectedCc.pipeline_stage) && (
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-500">Switch to Qualifier role to review this creator.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
