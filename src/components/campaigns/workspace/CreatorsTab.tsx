'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CoverageTag, PlatformBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import EvidenceCard from '@/components/ui/EvidenceCard';
import ScoreGauge, { DIMENSION_COLOR_HEX } from '@/components/ui/ScoreGauge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, Youtube, ExternalLink } from 'lucide-react';

// ─── Helpers ───

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
  pipeline_stage: string; scoring_status: string;
  overall_score: number | null; evidence_coverage: string | null;
  needs_manual_review: boolean | null; evaluated_at: string | null;
  updated_at: string; client_feedback: string | null; client_rating: string | null;
}

interface Evaluation {
  id: string; overall_score: number; evidence_coverage: string; needs_manual_review: boolean;
  needs_manual_review_reason: string | null; evaluated_at: string; rationale_md: string;
  score_technical_relevance: number; score_audience_alignment: number; score_content_quality: number;
  score_channel_performance: number; score_brand_fit: number;
  strengths_json: string[]; weaknesses_json: string[];
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

// ─── Creator Card ───

function CreatorCard({ cc, onClick }: { cc: CampaignCreator; onClick: () => void }) {
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
        {isScored && (
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-100">{cc.overall_score}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">score</div>
          </div>
        )}
      </div>

      {/* Creator info */}
      <div className="min-w-0">
        <div className="font-semibold text-sm leading-snug truncate transition-colors text-slate-100 group-hover:text-blue-400">
          {cc.creator_name}
        </div>
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

const DIMS = [
  { key: 'technical_relevance', label: 'Technical',  weight: 30 },
  { key: 'audience_alignment',  label: 'Audience',   weight: 25 },
  { key: 'content_quality',     label: 'Quality',    weight: 20 },
  { key: 'channel_performance', label: 'Channel',    weight: 15 },
  { key: 'brand_fit',           label: 'Brand Fit',  weight: 10 },
] as const;

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
  cc, evaluation, evidence, contentItems, angles, loading,
}: {
  cc: CampaignCreator;
  evaluation: Evaluation | null;
  evidence: EvidenceSnippet[];
  contentItems: ContentItem[];
  angles: ContentAngle[];
  loading: boolean;
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
          <h2 className="text-xl font-bold text-slate-100 leading-snug">{cc.creator_name}</h2>
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

      {/* Overall score */}
      <div className="flex flex-col items-center gap-4 py-4">
        <ScoreGauge score={evaluation.overall_score} size="xl" />
      </div>

      {/* Dimension scores */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Score Breakdown</h3>
        <div className="grid grid-cols-5 gap-4">
          {DIMS.map(d => {
            const score = (evaluation as unknown as Record<string, number>)[`score_${d.key}`] ?? 0;
            return (
              <div key={d.key} className="flex flex-col items-center gap-2">
                <ScoreGauge
                  score={score}
                  size="md"
                  label={d.label}
                  weight={d.weight}
                  color={DIMENSION_COLOR_HEX[d.key]}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">Strengths</h3>
          <ul className="space-y-2">
            {parseJsonArray(evaluation.strengths_json).map((s, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-green-400 flex-shrink-0 mt-0.5 text-base leading-none">✓</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#111827] rounded-xl p-4">
          <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Weaknesses</h3>
          <ul className="space-y-2">
            {parseJsonArray(evaluation.weaknesses_json).map((w, i) => (
              <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                <span className="text-red-400 flex-shrink-0 mt-0.5 text-base leading-none">×</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Evidence */}
      {evidence.length > 0 && (
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
      )}

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

export default function CreatorsTab({ campaign, campaignCreators }: Props) {
  const [selectedCc, setSelectedCc] = useState<CampaignCreator | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSnippet[]>([]);
  const [angles, setAngles] = useState<ContentAngle[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [creatorsPage, setCreatorsPage] = useState(1);
  const CREATORS_PAGE_SIZE = 25;
  const router = useRouter();

  const filteredCreators = (campaignCreators as CampaignCreator[]).filter(cc =>
    cc.pipeline_stage !== 'excluded' && cc.overall_score != null
  );
  const creatorsTotalPages = Math.max(1, Math.ceil(filteredCreators.length / CREATORS_PAGE_SIZE));
  const pagedCreators = filteredCreators.slice((creatorsPage - 1) * CREATORS_PAGE_SIZE, creatorsPage * CREATORS_PAGE_SIZE);

  const loadEvaluation = async (cc: CampaignCreator) => {
    setSelectedCc(cc);
    setEvaluation(null);
    setEvidence([]);
    setAngles([]);
    setContentItems([]);
    setLoadingEval(true);
    try {
      const res = await fetch(`/api/evaluations/${cc.id}`);
      const data = await res.json();
      setEvaluation(data?.evaluation || null);
      setEvidence(data?.evidenceSnippets || data?.evidence || []);
      setAngles(data?.contentAngles || data?.angles || []);
      setContentItems(data?.contentItems || []);
    } finally {
      setLoadingEval(false);
    }
  };

// ── Detail view (full-page) ──
  if (selectedCc) {
    return (
      <div>
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
          />
        </div>
      </div>
    );
  }

  // ── Grid view ──
  return (
    <div className="space-y-5">
      {pagedCreators.length === 0 ? (
        <div className="card">
          <EmptyState
            icon=""
            title="No creators yet"
            description="Go to Search Terms and click Generate Engagement Leads to discover creators."
          />
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {filteredCreators.length} creator{filteredCreators.length !== 1 ? 's' : ''} for {campaign.client_name || 'your brand'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Click any creator to view their evaluation and content angles.
              </p>
            </div>
          </div>

          {/* Creator grid — always 3 columns */}
          <div className="grid grid-cols-3 gap-4">
            {pagedCreators.map(cc => (
              <CreatorCard
                key={cc.id}
                cc={cc}
                onClick={() => loadEvaluation(cc)}
              />
            ))}
          </div>

          {/* Pagination */}
          {creatorsTotalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">Page {creatorsPage} of {creatorsTotalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCreatorsPage(p => Math.max(1, p - 1))} disabled={creatorsPage <= 1} className="p-1 text-slate-500 hover:bg-[#263044] rounded disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setCreatorsPage(p => Math.min(creatorsTotalPages, p + 1))} disabled={creatorsPage >= creatorsTotalPages} className="p-1 text-slate-500 hover:bg-[#263044] rounded disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
