'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CoverageTag, PlatformBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import EvidenceCard from '@/components/ui/EvidenceCard';
import ScoreGauge from '@/components/ui/ScoreGauge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useYouTubeQuotaGate } from '@/components/campaigns/YouTubeQuotaGate';
import { showToast } from '@/components/ui/Toaster';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, Youtube, ExternalLink, X, Plus, Sparkles, Loader2 } from 'lucide-react';

// ─── Helpers ───

function platformProfileUrl(platform: string, handle: string | null): string | null {
  if (!handle) return null;
  const h = handle.replace(/^@/, '');
  switch (platform) {
    case 'youtube': return `https://www.youtube.com/@${h}`;
    case 'medium':  return `https://medium.com/@${h}`;
    case 'devto':   return `https://dev.to/${h}`;
    default:        return null;
  }
}

function parseJsonArray(val: unknown): string[] {
  let arr: unknown[];
  if (Array.isArray(val)) {
    arr = val;
  } else if (typeof val === 'string') {
    try { const parsed = JSON.parse(val); arr = Array.isArray(parsed) ? parsed : []; } catch { return []; }
  } else {
    return [];
  }
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return (obj.text || obj.title || obj.quote || JSON.stringify(obj)) as string;
    }
    return String(item);
  });
}

// ─── Types ───

interface CampaignCreator {
  id: string; creator_id: string; creator_name: string; creator_platform: string;
  creator_handle: string | null; source: string | null;
  creator_subscriber_count?: number | null;
  creator_categories?: string | null;
  pipeline_stage: string; scoring_status: string;
  overall_score: number | null; evidence_coverage: string | null;
  needs_manual_review: boolean | null; evaluated_at: string | null;
  updated_at: string; client_feedback: string | null; client_rating: string | null;
}

interface Evaluation {
  id: string; overall_score: number; evidence_coverage: string; needs_manual_review: boolean;
  needs_manual_review_reason: string | null; evaluated_at: string; rationale_md: string;
  strengths_json: unknown[]; weaknesses_json: unknown[];
}

interface EvidenceSnippet {
  quote: string; url: string; title: string; platform: string;
  timestamp_start_seconds: number | null; timestamp_end_seconds: number | null;
  dimension: string; why_it_matters: string; published_at: string;
}

interface ContentAngle {
  title: string; format: string; persona: string; key_points_json: string[];
}

interface ContentItem {
  id: string; title: string; url: string; platform: string; published_at: string;
}

interface Props {
  campaign: { id: string; stage: string; client_name?: string };
  campaignCreators: CampaignCreator[];
  [key: string]: unknown;
}

// ─── Platform Avatar Colors ───

const PLATFORM_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  youtube:    { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', ring: 'rgba(239,68,68,0.35)' },
  medium:     { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', ring: 'rgba(34,197,94,0.35)' },
  devto:      { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', ring: 'rgba(59,130,246,0.35)' },
  linkedin:   { bg: 'rgba(56,189,248,0.12)', text: '#38bdf8', ring: 'rgba(56,189,248,0.35)' },
  github:     { bg: 'rgba(226,232,240,0.10)',text: '#94a3b8', ring: 'rgba(148,163,184,0.30)' },
  newsletter: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', ring: 'rgba(168,85,247,0.35)' },
  podcast:    { bg: 'rgba(244,114,182,0.12)',text: '#f472b6', ring: 'rgba(244,114,182,0.35)' },
  blog:       { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', ring: 'rgba(251,191,36,0.35)' },
};
const DEFAULT_PLATFORM = { bg: 'rgba(148,163,184,0.10)', text: '#94a3b8', ring: 'rgba(148,163,184,0.30)' };

// ─── Platform Logo ───

function PlatformLogo({ platform, color }: { platform: string; color: string }) {
  if (platform === 'youtube') {
    return <Youtube size={26} color={color} strokeWidth={1.5} />;
  }
  const abbrev: Record<string, string> = {
    medium: 'M', devto: 'D', linkedin: 'in', github: 'GH',
    newsletter: 'NL', podcast: '◎', blog: 'B',
  };
  return (
    <span style={{ color, fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
      {abbrev[platform] ?? platform.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Dismiss Modal ───

const DISMISS_REASONS = ['Too expensive', 'Wrong audience', 'Brand conflict', 'Already in talks', 'Other'];

function DismissModal({
  cc,
  onConfirm,
  onCancel,
  loading,
}: {
  cc: CampaignCreator;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e293b] border border-[#2d3748] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100 mb-1">Remove from campaign?</h3>
        <p className="text-sm text-slate-400 mb-4">{cc.creator_name} won&apos;t appear in this campaign again.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {DISMISS_REASONS.map(r => (
            <button
              key={r}
              onClick={() => setReason(reason === r ? '' : r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                reason === r
                  ? 'bg-red-900/40 border-red-600/60 text-red-300'
                  : 'bg-transparent border-[#2d3748] text-slate-400 hover:border-slate-500'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {reason === 'Other' && (
          <input
            autoFocus
            value={custom}
            onChange={e => setCustom(e.target.value)}
            placeholder="Describe the reason…"
            className="w-full bg-[#111827] border border-[#2d3748] rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 mb-4"
          />
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 border border-[#2d3748] hover:border-slate-500 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason === 'Other' ? custom : reason)}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50"
          >
            {loading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Creator Card ───

function CreatorCard({ cc, onClick, onDismiss, onFindSimilar, findSimilarDisabled }: { cc: CampaignCreator; onClick: () => void; onDismiss: (e: React.MouseEvent) => void; onFindSimilar: (e: React.MouseEvent) => void; findSimilarDisabled: boolean }) {
  const palette = PLATFORM_COLORS[cc.creator_platform] ?? DEFAULT_PLATFORM;
  const isScored = cc.overall_score != null;
  const handle = cc.creator_handle
    ? (cc.creator_platform === 'youtube' || cc.creator_platform === 'medium'
        ? `@${cc.creator_handle.replace(/^@/, '')}`
        : cc.creator_handle)
    : null;

  return (
    <div
      onClick={onClick}
      className="creator-card cursor-pointer rounded-2xl border p-5 group transition-all bg-[#1e293b] border-[#2d3748] hover:border-[#3d4f68] hover:bg-[#243048]"
    >
      {/* Platform logo avatar */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: palette.bg,
            boxShadow: `0 0 0 2px ${palette.ring}`,
          }}
        >
          <PlatformLogo platform={cc.creator_platform} color={palette.text} />
        </div>
        <div className="flex items-start gap-2">
          {isScored && (
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-100">{cc.overall_score}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wide">score</div>
            </div>
          )}
          <button
            onClick={onFindSimilar}
            disabled={findSimilarDisabled || !cc.creator_handle}
            title={cc.creator_handle ? 'Find more creators like this one' : 'Cannot find similar — creator has no handle'}
            className="p-1 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
          >
            <Sparkles size={14} />
          </button>
          <button
            onClick={onDismiss}
            title="Remove from campaign"
            className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Creator info */}
      <div className="min-w-0">
        {(() => {
          const profileUrl = platformProfileUrl(cc.creator_platform, cc.creator_handle);
          return profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="font-semibold text-sm leading-snug truncate transition-colors text-slate-100 hover:text-blue-400 block"
            >
              {cc.creator_name}
            </a>
          ) : (
            <div className="font-semibold text-sm leading-snug truncate transition-colors text-slate-100 group-hover:text-blue-400">
              {cc.creator_name}
            </div>
          );
        })()}
        {handle && (
          <div className="text-xs text-slate-500 truncate mt-0.5">{handle}</div>
        )}
        <div className="mt-2.5 flex items-center gap-1.5">
          <PlatformBadge platform={cc.creator_platform} />
          {isScored && (
            <span className="text-[10px] text-slate-500">Evaluated</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dimension Config ───

const VERDICT_LABEL: Record<string, string> = {
  strong_fit: 'Strong Fit',
  possible_fit: 'Possible Fit',
  weak_fit: 'Weak Fit',
  pass: 'Pass',
}

const VERDICT_STYLE: Record<string, string> = {
  strong_fit: 'bg-green-900/40 text-green-300 border border-green-700/50',
  possible_fit: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
  weak_fit: 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  pass: 'bg-slate-800 text-slate-400 border border-slate-700',
}

function getVerdict(score: number): string {
  if (score >= 80) return 'strong_fit'
  if (score >= 60) return 'possible_fit'
  if (score >= 40) return 'weak_fit'
  return 'pass'
}

// ─── Detail Panel ───

function FeedbackBox({ cc }: { cc: CampaignCreator }) {
  const [rating, setRating] = useState<string | null>(cc.client_rating ?? null)
  const [notes, setNotes] = useState(cc.client_feedback ?? '')
  const [saving, setSaving] = useState(false)

  async function save(newRating?: string | null, newNotes?: string) {
    setSaving(true)
    await fetch(`/api/campaign-creators/${cc.id}/feedback`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        feedback: (newNotes ?? notes) || null,
        rating: newRating !== undefined ? newRating : rating,
      }),
    })
    setSaving(false)
  }

  function toggleRating(val: 'good' | 'bad') {
    const next = rating === val ? null : val
    setRating(next)
    save(next)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rate Creator</h3>
      <div className="flex gap-2">
        <button
          onClick={() => toggleRating('good')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
            rating === 'good'
              ? 'bg-green-600 border-green-500 text-white'
              : 'bg-transparent border-[#2d3748] text-slate-400 hover:border-green-600/50 hover:text-green-400'
          }`}
        >
          👍 Good
        </button>
        <button
          onClick={() => toggleRating('bad')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
            rating === 'bad'
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-transparent border-[#2d3748] text-slate-400 hover:border-red-600/50 hover:text-red-400'
          }`}
        >
          👎 Bad
        </button>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={() => save()}
          rows={3}
          placeholder="Any concerns or context… (auto-saves)"
          className="w-full bg-[#111827] border border-[#2d3748] rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50"
        />
      </div>
      {saving && <p className="text-xs text-slate-500">Saving…</p>}
    </div>
  )
}

function DetailPanel({
  cc, evaluation, evidence, contentItems, angles, loading, enriching,
}: {
  cc: CampaignCreator;
  evaluation: Evaluation | null;
  evidence: EvidenceSnippet[];
  contentItems: ContentItem[];
  angles: ContentAngle[];
  loading: boolean;
  enriching: boolean;
}) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const palette = PLATFORM_COLORS[cc.creator_platform] ?? DEFAULT_PLATFORM;
  const handle = cc.creator_handle
    ? `@${cc.creator_handle.replace(/^@/, '')}`
    : null;

  const featuredEvidence = evidence.slice(0, 3);
  const remainingEvidence = evidence.slice(3);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Loading evaluation…</span>
        </div>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <p className="text-sm">{cc.overall_score === null ? 'Not scored yet.' : 'No evaluation found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Creator identity */}
      <div className="flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: palette.bg, boxShadow: `0 0 0 2px ${palette.ring}` }}
        >
          <PlatformLogo platform={cc.creator_platform} color={palette.text} />
        </div>
        <div className="min-w-0">
          {(() => {
            const profileUrl = platformProfileUrl(cc.creator_platform, cc.creator_handle);
            return profileUrl ? (
              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-1.5">
                <h2 className="text-xl font-bold text-slate-100 leading-snug group-hover:text-blue-400 transition-colors">{cc.creator_name}</h2>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
              </a>
            ) : (
              <h2 className="text-xl font-bold text-slate-100 leading-snug">{cc.creator_name}</h2>
            );
          })()}
          {handle && <p className="text-sm text-slate-500 mt-0.5">{handle}</p>}
          <div className="flex items-center gap-2 mt-2">
            <PlatformBadge platform={cc.creator_platform} />
            <CoverageTag coverage={evaluation.evidence_coverage || 'none'} />
            {evaluation.evaluated_at && (
              <span className="text-xs text-slate-500">Evaluated {formatDate(evaluation.evaluated_at)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Manual review warning */}
      {evaluation.needs_manual_review && (
        <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-4">
          <p className="text-sm font-semibold text-orange-400">⚠ Needs Manual Review</p>
          <p className="text-sm text-orange-300 mt-1">{evaluation.needs_manual_review_reason}</p>
        </div>
      )}

      {/* Score + verdict */}
      <div className="flex flex-col items-center gap-3 py-4">
        <ScoreGauge score={evaluation.overall_score} size="xl" />
        {(() => {
          const verdict = getVerdict(evaluation.overall_score)
          return (
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${VERDICT_STYLE[verdict]}`}>
              {VERDICT_LABEL[verdict]}
            </span>
          )
        })()}
      </div>

      {/* Fit summary */}
      {evaluation.rationale_md && (
        <div className="bg-[#111827] rounded-xl p-4">
          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.rationale_md}</p>
        </div>
      )}

      {/* Standout Signals & Concerns */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">Standout Signals</h3>
          <ul className="space-y-2">
            {parseJsonArray(evaluation.strengths_json).length === 0
              ? <li className="text-sm text-slate-500 italic">No standout signals identified</li>
              : parseJsonArray(evaluation.strengths_json).map((s, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-green-400 flex-shrink-0 mt-0.5 text-base leading-none">✓</span>
                  {typeof s === 'object' && s !== null ? (s as { text: string }).text : s}
                </li>
              ))
            }
          </ul>
        </div>
        <div className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Concerns</h3>
          <ul className="space-y-2">
            {parseJsonArray(evaluation.weaknesses_json).length === 0
              ? <li className="text-sm text-slate-500 italic">No concerns identified</li>
              : parseJsonArray(evaluation.weaknesses_json).map((w, i) => (
                <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                  <span className="text-red-400 flex-shrink-0 mt-0.5 text-base leading-none">×</span>
                  {typeof w === 'object' && w !== null ? (w as { text: string }).text : w}
                </li>
              ))
            }
          </ul>
        </div>
      </div>

      {/* Evidence */}
      {(() => {
        const belowThreshold = evaluation.overall_score < 80
        const isPending = evaluation.evidence_coverage === 'pending'

        if (enriching || (isPending && !belowThreshold)) {
          return (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Evidence</h3>
              <div className="bg-[#111827] rounded-xl p-6 flex items-center gap-3 text-slate-400">
                <div className="w-5 h-5 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Generating evidence and content angles…</span>
              </div>
            </div>
          )
        }

        if (belowThreshold && evidence.length === 0) {
          return (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Key Evidence</h3>
              <p className="text-sm text-slate-500 italic">Evidence not generated for creators scoring below 80.</p>
            </div>
          )
        }

        if (evidence.length === 0) return null

        return (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Key Evidence <span className="text-slate-600 font-normal">({evidence.length})</span>
            </h3>
            <div className="space-y-2">
              {featuredEvidence.map((ev, i) => (
                <EvidenceCard
                  key={i}
                  featured
                  quote={ev.quote}
                  url={ev.url}
                  title={ev.title}
                  platform={ev.platform}
                  timestamp_start={ev.timestamp_start_seconds}
                  timestamp_end={ev.timestamp_end_seconds}
                  dimension={ev.dimension}
                  why_it_matters={ev.why_it_matters}
                  published_at={ev.published_at}
                />
              ))}
            </div>
            {remainingEvidence.length > 0 && (
              <>
                {showAllEvidence ? (
                  <div className="space-y-2 mt-2">
                    {remainingEvidence.map((ev, i) => (
                      <EvidenceCard
                        key={i + 3}
                        quote={ev.quote}
                        url={ev.url}
                        title={ev.title}
                        platform={ev.platform}
                        timestamp_start={ev.timestamp_start_seconds}
                        timestamp_end={ev.timestamp_end_seconds}
                        dimension={ev.dimension}
                        why_it_matters={ev.why_it_matters}
                        published_at={ev.published_at}
                      />
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAllEvidence(true)}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-3 font-medium"
                  >
                    <ChevronDown size={15} />
                    Show {remainingEvidence.length} more
                  </button>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* Content Evaluated */}
      {contentItems.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Content Evaluated <span className="text-slate-600 font-normal">({contentItems.length})</span>
          </h3>
          <div className="space-y-2">
            {contentItems.map(ci => (
              <div key={ci.id} className="bg-[#111827] rounded-xl p-3 flex items-center gap-3">
                <span className="badge bg-slate-800/50 text-slate-400 border-slate-600/50 text-[10px] shrink-0">{ci.platform}</span>
                <a
                  href={ci.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline truncate flex-1"
                  title={ci.title}
                >
                  {ci.title}
                </a>
                <ExternalLink size={12} className="text-slate-600 shrink-0" />
                {ci.published_at && (
                  <span className="text-xs text-slate-500 shrink-0">{formatDate(ci.published_at)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Angles */}
      {angles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Content Angles</h3>
          <div className="space-y-3">
            {angles.map((angle, i) => (
              <div key={i} className="bg-[#111827] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-200">{angle.title}</span>
                  <span className="badge bg-teal-900/30 text-teal-400 border-teal-700/50 text-xs">{angle.format}</span>
                  {angle.persona && <span className="badge bg-purple-900/30 text-purple-400 border-purple-700/50 text-xs">{angle.persona}</span>}
                </div>
                <ul className="space-y-1">
                  {parseJsonArray(angle.key_points_json).map((kp, j) => (
                    <li key={j} className="text-sm text-slate-400">· {kp}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client feedback */}
      <FeedbackBox cc={cc} />
    </div>
  );
}

// ─── Main Component ───

interface RowEvalData {
  evaluation: Evaluation | null;
  loading: boolean;
}

function CreatorRow({
  cc, expanded, evalData, onToggle, onDismiss, onFindSimilar, findSimilarDisabled, onAddToOutreach, addBusy, addDone,
}: {
  cc: CampaignCreator;
  expanded: boolean;
  evalData?: RowEvalData;
  onToggle: () => void;
  onDismiss: () => void;
  onFindSimilar: () => void;
  findSimilarDisabled: boolean;
  onAddToOutreach: () => void;
  addBusy: boolean;
  addDone: boolean;
}) {
  const isScored = cc.overall_score != null;
  const handle = cc.creator_handle
    ? (cc.creator_platform === 'youtube' || cc.creator_platform === 'medium'
        ? `@${cc.creator_handle.replace(/^@/, '')}`
        : cc.creator_handle)
    : null;
  const profileUrl = platformProfileUrl(cc.creator_platform, cc.creator_handle);
  const score = cc.overall_score ?? 0;
  const subsLabel = formatSubscribers(cc.creator_subscriber_count ?? null, cc.creator_platform);
  const topics = (cc.creator_categories || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Collapsed row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:opacity-90"
        style={{ background: expanded ? 'var(--bg-surface-2)' : 'transparent' }}
      >
        <span
          className="w-3.5 h-3.5 rounded-sm shrink-0"
          style={{ border: '1px solid var(--border-default)' }}
        />
        <div className="min-w-0 flex-1">
          {profileUrl ? (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] font-semibold hover:underline"
              style={{ color: 'var(--text-primary)' }}
            >
              {cc.creator_name}
            </a>
          ) : (
            <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {cc.creator_name}
            </span>
          )}
          {(handle || subsLabel) && (
            <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {handle}
              {handle && subsLabel ? ' · ' : ''}
              {subsLabel}
            </div>
          )}
        </div>
        <div className="shrink-0">
          <PlatformBadge platform={cc.creator_platform} />
        </div>
        <div className="shrink-0 text-[12px] font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          $TBD
        </div>
        {isScored && (
          <div className="shrink-0 tabular-nums">
            <span className="text-[15px] font-semibold" style={{ color: 'var(--accent)' }}>{score}</span>
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>/100</span>
          </div>
        )}
        <div className="shrink-0" style={{ color: 'var(--text-muted)' }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {evalData?.loading ? (
            <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={13} className="animate-spin" />
              Loading evaluation…
            </div>
          ) : evalData?.evaluation ? (
            <RowEvalBody evaluation={evalData.evaluation} topics={topics} />
          ) : (
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              No evaluation available.
            </div>
          )}

          <div
            className="flex items-center justify-between mt-5 pt-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="btn-secondary h-8 text-[12px]"
              >
                Exclude
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFindSimilar(); }}
                disabled={findSimilarDisabled || !cc.creator_handle}
                className="btn-ghost h-8 text-[12px]"
                title={cc.creator_handle ? 'Find more like this creator' : 'Cannot find similar — no handle'}
              >
                <Sparkles size={12} />
                Find similar
              </button>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onAddToOutreach(); }}
              disabled={addBusy || addDone}
              className="btn-primary h-8 text-[12px] disabled:opacity-60"
              title={addDone ? 'Already in outreach queue' : 'Add to outreach and generate draft'}
            >
              {addBusy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {addDone ? 'Added' : addBusy ? 'Drafting…' : 'Add to outreach'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowEvalBody({ evaluation, topics }: { evaluation: Evaluation; topics: string[] }) {
  const strengths = parseJsonArray(evaluation.strengths_json);
  const weaknesses = parseJsonArray(evaluation.weaknesses_json);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Strengths
          </div>
          {strengths.length === 0 ? (
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>—</div>
          ) : (
            <ul className="space-y-1.5">
              {strengths.map((s, i) => (
                <li key={i} className="text-[12px] flex gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--accent)' }}>•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Considerations
          </div>
          {weaknesses.length === 0 ? (
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>—</div>
          ) : (
            <ul className="space-y-1.5">
              {weaknesses.map((w, i) => (
                <li key={i} className="text-[12px] flex gap-2" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {topics.length > 0 && (
        <div>
          <div
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            Topics
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 rounded-md text-[11px]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-secondary)' }}
          >
            Rate history
          </div>
          <span
            className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            mock
          </span>
        </div>
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>TBD</div>
      </div>
    </div>
  );
}

function formatSubscribers(n: number | null, platform: string): string {
  if (n == null || n <= 0) return '';
  const label = platform === 'youtube' ? 'subs' : platform === 'medium' || platform === 'devto' ? 'followers' : 'subs';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ${label}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k ${label}`;
  return `${n} ${label}`;
}

export default function CreatorsTab({ campaign, campaignCreators }: Props) {
  const { data: session } = useSession();
  const [selectedCc, setSelectedCc] = useState<CampaignCreator | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSnippet[]>([]);
  const [angles, setAngles] = useState<ContentAngle[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [creatorsPage, setCreatorsPage] = useState(1);
  const [dismissTarget, setDismissTarget] = useState<CampaignCreator | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [surfaceMoreRunning, setSurfaceMoreRunning] = useState(false);
  const [surfaceMoreError, setSurfaceMoreError] = useState<string | null>(null);
  const ytQuotaGate = useYouTubeQuotaGate();
  const [addingToOutreach, setAddingToOutreach] = useState<Set<string>>(new Set());
  const [addedToOutreach, setAddedToOutreach] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [evalCache, setEvalCache] = useState<Map<string, RowEvalData>>(new Map());
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const CREATORS_PAGE_SIZE = 25;
  const router = useRouter();

  // On mount: check if a pipeline is already running and start polling if so
  useEffect(() => {
    fetch(`/api/campaigns/${campaign.id}/pipeline-status`)
      .then(r => r.json())
      .then(data => {
        if (data.job?.status === 'running' || data.job?.status === 'queued') {
          setSurfaceMoreRunning(true);
        }
      })
      .catch(() => {});
  }, [campaign.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for surface-more job completion
  useEffect(() => {
    if (!surfaceMoreRunning) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaign.id}/pipeline-status`);
        const data = await res.json();
        if (data.job?.status === 'completed' || data.job?.status === 'failed') {
          setSurfaceMoreRunning(false);
          if (data.job.status === 'failed') {
            setSurfaceMoreError('Pipeline failed — please try again.');
          } else {
            router.refresh();
          }
        }
      } catch { /* ignore transient fetch errors */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [surfaceMoreRunning, campaign.id, router]);

  async function handleAddToOutreach(cc: CampaignCreator) {
    if (addedToOutreach.has(cc.id) || addingToOutreach.has(cc.id)) return;
    let uid: string | null = (session?.user as { id?: string } | undefined)?.id ?? null;
    if (!uid) {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('yard_current_user') : null;
      if (raw) { try { uid = (JSON.parse(raw) as { id: string }).id ?? raw; } catch { uid = raw; } }
    }
    if (!uid) { showToast('error', 'Not signed in'); return }
    setAddingToOutreach(prev => new Set(prev).add(cc.id));
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${cc.id}/add-to-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddedToOutreach(prev => new Set(prev).add(cc.id));
        if (data.already_exists) {
          showToast('info', 'Already in outreach queue');
        } else if (data.status === 'draft_failed') {
          showToast('error', 'Drafting failed — see Outreach tab');
        } else {
          showToast('success', 'Added to outreach · drafting email');
        }
      } else {
        showToast('error', data.error || 'Failed to add to outreach');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setAddingToOutreach(prev => { const n = new Set(prev); n.delete(cc.id); return n });
    }
  }

  async function handleSurfaceMore(seedCreatorId?: string) {
    setSurfaceMoreError(null);
    const proceed = await ytQuotaGate.check();
    if (!proceed) return;
    let userId: string | null = (session?.user as { id?: string } | undefined)?.id ?? null;
    if (!userId) {
      const rawUser = typeof window !== 'undefined' ? localStorage.getItem('yard_current_user') : null;
      if (rawUser) {
        try { userId = (JSON.parse(rawUser) as { id: string }).id ?? rawUser; } catch { userId = rawUser; }
      }
    }
    if (!userId) {
      setSurfaceMoreError('No active user — please reload the page.');
      return;
    }
    setSurfaceMoreRunning(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/surface-more`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seedCreatorId ? { user_id: userId, seed_creator_id: seedCreatorId } : { user_id: userId }),
      });
      if (!res.ok) {
        let msg = 'Failed to start pipeline.';
        try { const d = await res.json(); msg = d.error || msg; } catch { /* non-JSON body */ }
        setSurfaceMoreError(msg);
        setSurfaceMoreRunning(false);
      }
    } catch {
      setSurfaceMoreError('Network error — please try again.');
      setSurfaceMoreRunning(false);
    }
  }

  async function confirmDismiss(reason: string) {
    if (!dismissTarget) return;
    setDismissing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${dismissTarget.id}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || null }),
      });
      if (res.ok) {
        setDismissedIds(prev => { const s = new Set(prev); s.add(dismissTarget!.id); return s; });
        if (selectedCc?.id === dismissTarget.id) setSelectedCc(null);
      }
    } catch { /* Network error — leave creator visible */ }
    setDismissTarget(null);
    setDismissing(false);
  }

  const filteredCreators = (campaignCreators as CampaignCreator[]).filter(cc =>
    cc.pipeline_stage !== 'excluded' &&
    cc.pipeline_stage !== 'dismissed' &&
    cc.overall_score != null &&
    !dismissedIds.has(cc.id) &&
    (platformFilter === 'all' || cc.creator_platform === platformFilter)
  );
  const creatorsTotalPages = Math.max(1, Math.ceil(filteredCreators.length / CREATORS_PAGE_SIZE));
  const pagedCreators = filteredCreators.slice((creatorsPage - 1) * CREATORS_PAGE_SIZE, creatorsPage * CREATORS_PAGE_SIZE);

  const handleToggleExpand = async (cc: CampaignCreator) => {
    const next = new Set(expandedIds);
    if (next.has(cc.id)) {
      next.delete(cc.id);
      setExpandedIds(next);
      return;
    }
    next.add(cc.id);
    setExpandedIds(next);
    if (evalCache.has(cc.id)) return;
    setEvalCache((prev) => {
      const m = new Map(prev);
      m.set(cc.id, { evaluation: null, loading: true });
      return m;
    });
    try {
      const res = await fetch(`/api/evaluations/${cc.id}`);
      const data = await res.json();
      const evalObj = (data?.evaluation as Evaluation | null) || null;
      setEvalCache((prev) => {
        const m = new Map(prev);
        m.set(cc.id, { evaluation: evalObj, loading: false });
        return m;
      });

    } catch {
      setEvalCache((prev) => {
        const m = new Map(prev);
        m.set(cc.id, { evaluation: null, loading: false });
        return m;
      });
    }
  };

  const loadEvaluation = async (cc: CampaignCreator) => {
    setSelectedCc(cc);
    setEvaluation(null);
    setEvidence([]);
    setAngles([]);
    setContentItems([]);
    setLoadingEval(true);
    setEnriching(false);
    try {
      const res = await fetch(`/api/evaluations/${cc.id}`);
      const data = await res.json();
      const evalObj = data?.evaluation || null;
      setEvaluation(evalObj);
      setEvidence(data?.evidenceSnippets || data?.evidence || []);
      setAngles(data?.contentAngles || data?.angles || []);
      setContentItems(data?.contentItems || []);

      // Lazy Stage 2: if this creator scored >=80 and evidence hasn't been generated,
      // kick off enrichment and refetch once done.
      if (evalObj && evalObj.evidence_coverage === 'pending' && evalObj.overall_score >= 80) {
        setEnriching(true);
        try {
          const enrichRes = await fetch(`/api/evaluations/${cc.id}/enrich`, { method: 'POST' });
          if (enrichRes.ok) {
            const refreshed = await fetch(`/api/evaluations/${cc.id}`);
            const refreshedData = await refreshed.json();
            setEvaluation(refreshedData?.evaluation || null);
            setEvidence(refreshedData?.evidenceSnippets || []);
            setAngles(refreshedData?.contentAngles || []);
          }
        } finally {
          setEnriching(false);
        }
      }
    } finally {
      setLoadingEval(false);
    }
  };

// ── Detail view (full-page) ──
  if (selectedCc) {
    return (
      <div>
        {ytQuotaGate.modal}
        {/* Back nav */}
        <button
          onClick={() => setSelectedCc(null)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to creators
        </button>

        <div className="max-w-2xl mx-auto">
          <DetailPanel
            cc={selectedCc}
            evaluation={evaluation}
            evidence={evidence}
            contentItems={contentItems}
            angles={angles}
            loading={loadingEval}
            enriching={enriching}
          />
        </div>
      </div>
    );
  }

  // ── Grid view ──
  return (
    <div className="space-y-5">
      {ytQuotaGate.modal}
      {surfaceMoreRunning && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm">
          <Loader2 size={15} className="animate-spin shrink-0" />
          <span>Pipeline running — finding and scoring new creators. This takes a few minutes.</span>
        </div>
      )}
      {pagedCreators.length === 0 ? (
        <div className="card">
          <EmptyState
            icon=""
            title="No creators yet"
            description="Go to Search Terms and click Generate Engagement Leads to discover creators."
          />
        </div>
      ) : filteredCreators.length === 0 ? (
        <div className="space-y-4">
          <div className="card">
            <EmptyState
              icon=""
              title="All creators removed"
              description="You've removed all creators from this campaign. Surface more to find new ones."
            />
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => handleSurfaceMore()}
              disabled={surfaceMoreRunning}
              className="btn-primary text-[13px]"
            >
              {surfaceMoreRunning ? (
                <><Loader2 size={13} className="animate-spin" />Finding more…</>
              ) : (
                <><Sparkles size={13} />Find more opportunities</>
              )}
            </button>
          </div>
          {surfaceMoreError && <p className="text-xs text-red-400 text-center">{surfaceMoreError}</p>}
        </div>
      ) : (
        <>
          {/* Subtitle + platform filter */}
          {(() => {
            const allPlatforms = (campaignCreators as CampaignCreator[])
              .filter(cc => cc.overall_score != null && !dismissedIds.has(cc.id) && cc.pipeline_stage !== 'excluded' && cc.pipeline_stage !== 'dismissed')
              .map(cc => cc.creator_platform);
            const presentPlatforms = Array.from(new Set(allPlatforms));
            const PLATFORM_CHIPS: { value: string; label: string }[] = [
              { value: 'youtube', label: 'YT' },
              { value: 'devto', label: 'DT' },
              { value: 'twitter', label: 'X' },
              { value: 'medium', label: 'MD' },
              { value: 'newsletter', label: 'NL' },
            ].filter(p => presentPlatforms.includes(p.value));
            const showFilter = PLATFORM_CHIPS.length >= 2;
            return (
              <div className="flex items-start justify-between gap-6">
                <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Qualified experts for new content, scored on technical depth, audience fit, and brand alignment.
                </div>
                {showFilter && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                    <button
                      onClick={() => { setPlatformFilter('all'); setCreatorsPage(1); }}
                      className="h-7 px-3 rounded-full text-[11px] font-semibold tracking-wide transition-colors"
                      style={platformFilter === 'all'
                        ? { background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' }
                        : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
                      }
                    >
                      All platforms
                    </button>
                    {PLATFORM_CHIPS.map(p => (
                      <button
                        key={p.value}
                        onClick={() => { setPlatformFilter(p.value); setCreatorsPage(1); }}
                        className="h-7 px-3 rounded-full text-[11px] font-semibold tracking-wide transition-colors"
                        style={platformFilter === p.value
                          ? { background: 'transparent', color: 'var(--accent)', border: '1.5px solid var(--accent)' }
                          : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Row list */}
          <div className="space-y-2">
            {pagedCreators.map(cc => (
              <CreatorRow
                key={cc.id}
                cc={cc}
                expanded={expandedIds.has(cc.id)}
                evalData={evalCache.get(cc.id)}
                onToggle={() => handleToggleExpand(cc)}
                onDismiss={() => setDismissTarget(cc)}
                onFindSimilar={() => handleSurfaceMore(cc.creator_id)}
                findSimilarDisabled={surfaceMoreRunning}
                onAddToOutreach={() => handleAddToOutreach(cc)}
                addBusy={addingToOutreach.has(cc.id)}
                addDone={addedToOutreach.has(cc.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {creatorsTotalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Page {creatorsPage} of {creatorsTotalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCreatorsPage(p => Math.max(1, p - 1))} disabled={creatorsPage <= 1} className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setCreatorsPage(p => Math.min(creatorsTotalPages, p + 1))} disabled={creatorsPage >= creatorsTotalPages} className="p-1 rounded disabled:opacity-30" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Find more opportunities */}
          <div className="pt-2">
            <button
              onClick={() => handleSurfaceMore()}
              disabled={surfaceMoreRunning}
              className="btn-secondary h-8 text-[13px] font-semibold"
            >
              {surfaceMoreRunning ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Finding more…
                </>
              ) : (
                <>
                  Find more opportunities
                  <ArrowRight size={13} />
                </>
              )}
            </button>
            {surfaceMoreError && (
              <p className="text-xs mt-1" style={{ color: '#f87171' }}>{surfaceMoreError}</p>
            )}
          </div>
        </>
      )}

      {/* Dismiss modal */}
      {dismissTarget && (
        <DismissModal
          cc={dismissTarget}
          onConfirm={confirmDismiss}
          onCancel={() => setDismissTarget(null)}
          loading={dismissing}
        />
      )}
    </div>
  );
}
