'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { CoverageTag, PlatformBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import EvidenceCard from '@/components/ui/EvidenceCard';
import ScoreGauge, { DIMENSION_COLOR_HEX } from '@/components/ui/ScoreGauge';
import { useRole } from '@/components/layout/Shell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

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
  updated_at: string;
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

// ─── Platform Colors ───

const PLATFORM_AVATAR: Record<string, { bg: string; text: string; ring: string }> = {
  youtube:    { bg: 'rgba(239,68,68,0.12)', text: '#f87171', ring: 'rgba(239,68,68,0.35)' },
  medium:     { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', ring: 'rgba(34,197,94,0.35)' },
  devto:      { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', ring: 'rgba(59,130,246,0.35)' },
  linkedin:   { bg: 'rgba(56,189,248,0.12)', text: '#38bdf8', ring: 'rgba(56,189,248,0.35)' },
  github:     { bg: 'rgba(226,232,240,0.10)', text: '#94a3b8', ring: 'rgba(148,163,184,0.30)' },
  newsletter: { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', ring: 'rgba(168,85,247,0.35)' },
  podcast:    { bg: 'rgba(244,114,182,0.12)', text: '#f472b6', ring: 'rgba(244,114,182,0.35)' },
  blog:       { bg: 'rgba(251,191,36,0.12)',  text: '#fbbf24', ring: 'rgba(251,191,36,0.35)' },
};
const DEFAULT_AVATAR = { bg: 'rgba(148,163,184,0.10)', text: '#94a3b8', ring: 'rgba(148,163,184,0.30)' };

// ─── Creator Card ───

function CreatorCard({ cc, onClick }: { cc: CampaignCreator; onClick: () => void }) {
  const initial = cc.creator_name.charAt(0).toUpperCase();
  const avatar = PLATFORM_AVATAR[cc.creator_platform] || DEFAULT_AVATAR;
  const isScored = cc.overall_score != null;
  const handle = cc.creator_handle
    ? (cc.creator_platform === 'youtube' || cc.creator_platform === 'medium'
      ? `@${cc.creator_handle.replace(/^@/, '')}`
      : cc.creator_handle)
    : null;

  return (
    <div
      onClick={onClick}
      className="creator-card cursor-pointer rounded-xl bg-[#1e293b] border border-[#2d3748] p-4 group"
    >
      <div className="flex items-center gap-3.5">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{
              background: avatar.bg,
              color: avatar.text,
              boxShadow: `0 0 0 2.5px ${avatar.ring}`,
            }}
          >
            {initial}
          </div>
          {isScored && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-[#1e293b]" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-100 truncate group-hover:text-blue-400 transition-colors">
            {cc.creator_name}
          </div>
          {handle && (
            <div className="text-xs text-slate-500 truncate">{handle}</div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <PlatformBadge platform={cc.creator_platform} />
            {isScored && (
              <span className="text-[10px] text-slate-500">Evaluated</span>
            )}
          </div>
        </div>

        {/* Chevron hint */}
        {isScored && (
          <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
        )}
      </div>
    </div>
  );
}

// ─── Dimension Config ───

const DIMS = [
  { key: 'technical_relevance', label: 'Technical', weight: 30 },
  { key: 'audience_alignment', label: 'Audience', weight: 25 },
  { key: 'content_quality', label: 'Quality', weight: 20 },
  { key: 'channel_performance', label: 'Channel', weight: 15 },
  { key: 'brand_fit', label: 'Brand Fit', weight: 10 },
] as const;

// ─── Drawer Content ───

function DrawerContent({ evaluation, evidence, contentItems, angles }: {
  evaluation: Evaluation;
  evidence: EvidenceSnippet[];
  contentItems: ContentItem[];
  angles: ContentAngle[];
}) {
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const featuredEvidence = evidence.slice(0, 3);
  const remainingEvidence = evidence.slice(3);

  return (
    <div className="space-y-0">
      {/* Section A: Hero Score */}
      <div className="drawer-hero px-6 py-6 -mx-5 -mt-5 mb-5 rounded-t-xl flex flex-col items-center gap-3">
        <ScoreGauge score={evaluation.overall_score} size="lg" />
        <div className="flex items-center gap-3">
          <CoverageTag coverage={evaluation.evidence_coverage || 'none'} />
          {evaluation.evaluated_at && (
            <span className="text-[11px] text-slate-500">
              Evaluated {formatDate(evaluation.evaluated_at)}
            </span>
          )}
        </div>
        {evaluation.needs_manual_review && (
          <div className="w-full bg-orange-900/20 border border-orange-700/40 rounded-md p-3 mt-2">
            <p className="text-xs font-semibold text-orange-400">{'\u26A0'} Needs Manual Review</p>
            <p className="text-xs text-orange-300 mt-0.5">{evaluation.needs_manual_review_reason}</p>
          </div>
        )}
      </div>

      {/* Section B: Dimension Gauges */}
      <div className="px-1 mb-5">
        <div className="grid grid-cols-5 gap-3">
          {DIMS.map(d => {
            const score = (evaluation as unknown as Record<string, number>)[`score_${d.key}`] ?? 0;
            return (
              <ScoreGauge
                key={d.key}
                score={score}
                size="md"
                label={d.label}
                weight={d.weight}
                color={DIMENSION_COLOR_HEX[d.key]}
              />
            );
          })}
        </div>
      </div>

      {/* Section C: Featured Evidence */}
      {evidence.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Key Evidence ({evidence.length})
          </h4>
          <div className="space-y-1">
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
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 font-medium"
                >
                  <ChevronDown size={14} />
                  Show {remainingEvidence.length} more...
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Section D: Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">Strengths</h4>
          <ul className="space-y-1">
            {(parseJsonArray(evaluation.strengths_json)).map((s: string, i: number) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                <span className="text-green-400 flex-shrink-0 mt-0.5">{'\u2713'}</span>{s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">Weaknesses</h4>
          <ul className="space-y-1">
            {(parseJsonArray(evaluation.weaknesses_json)).map((w: string, i: number) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                <span className="text-red-400 flex-shrink-0 mt-0.5">{'\u00D7'}</span>{w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Content Evaluated */}
      {contentItems.length > 0 && (
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Content Evaluated ({contentItems.length})
          </h4>
          <div className="space-y-1.5">
            {contentItems.map(ci => (
              <div key={ci.id} className="bg-[#111827] rounded-md p-2 flex items-center gap-2 text-xs">
                <span className="badge bg-slate-800/50 text-slate-400 border-slate-600/50 text-[10px] shrink-0">{ci.platform}</span>
                <a
                  href={ci.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline truncate"
                  title={ci.title}
                >
                  {ci.title}
                </a>
                {ci.published_at && (
                  <span className="text-slate-500 shrink-0">{formatDate(ci.published_at)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Angles */}
      {angles.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Content Angles</h4>
          <div className="space-y-2">
            {angles.map((angle, i) => (
              <div key={i} className="bg-[#111827] rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-slate-200">{angle.title}</span>
                  <span className="badge bg-teal-900/30 text-teal-400 border-teal-700/50 text-xs">{angle.format}</span>
                  {angle.persona && <span className="badge bg-purple-900/30 text-purple-400 border-purple-700/50 text-xs">{angle.persona}</span>}
                </div>
                <ul className="space-y-0.5">
                  {parseJsonArray(angle.key_points_json).map((kp: string, j: number) => (
                    <li key={j} className="text-xs text-slate-400">{'\u00B7'} {kp}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export default function CreatorsTab({ campaign, campaignCreators }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCc, setSelectedCc] = useState<CampaignCreator | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSnippet[]>([]);
  const [angles, setAngles] = useState<ContentAngle[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [creatorsPage, setCreatorsPage] = useState(1);
  const CREATORS_PAGE_SIZE = 25;
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  // Show scored creators only (the results the client cares about)
  const filteredCreators = (campaignCreators as CampaignCreator[]).filter(cc =>
    cc.pipeline_stage !== 'excluded' && cc.overall_score != null
  );
  const creatorsTotalPages = Math.max(1, Math.ceil(filteredCreators.length / CREATORS_PAGE_SIZE));
  const pagedCreators = filteredCreators.slice((creatorsPage - 1) * CREATORS_PAGE_SIZE, creatorsPage * CREATORS_PAGE_SIZE);


  const loadEvaluation = async (cc: CampaignCreator) => {
    setSelectedCc(cc);
    setDrawerOpen(true);
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

  const handleAddCreatorUrl = async () => {
    if (!addUrl.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/campaigns/creators/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, creator_url: addUrl, user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Creator added to campaign');
        setAddUrl('');
        router.refresh();
      } else {
        addToast('error', data.error || 'Failed to add creator');
      }
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Creator Cards */}
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
          {/* Flashy header */}
          <div className="text-center pb-2">
            <h2 className="text-lg font-semibold text-slate-100">
              {filteredCreators.length} curated creator{filteredCreators.length !== 1 ? 's' : ''} for {campaign.client_name || 'your brand'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Hand-picked and evaluated to help grow your brand's reach. Click any creator for details.
            </p>
          </div>

          {/* Subtle toolbar */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <input
                className="input-field w-56 text-xs"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                placeholder="Add creator by URL…"
                onKeyDown={e => { if (e.key === 'Enter') handleAddCreatorUrl(); }}
              />
              <button onClick={handleAddCreatorUrl} disabled={addLoading} className="btn-secondary text-xs">
                {addLoading ? '…' : 'Add'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
            {pagedCreators.map(cc => (
              <CreatorCard key={cc.id} cc={cc} onClick={() => loadEvaluation(cc)} />
            ))}
          </div>

          {/* Pagination */}
          {creatorsTotalPages > 1 && (
            <div className="flex items-center justify-between">
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

      {/* Evaluation Modal */}
      <Modal open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selectedCc?.creator_name || ''} size="xl">
        {loadingEval ? (
          <div className="flex items-center justify-center h-32 text-slate-500">
            <div className="animate-spin text-2xl">{'\u27F3'}</div>
          </div>
        ) : !evaluation ? (
          <div className="p-4 text-center text-slate-500">
            <p className="text-sm">{selectedCc?.overall_score === null ? 'Not scored yet.' : 'No evaluation found.'}</p>
          </div>
        ) : (
          <DrawerContent
            evaluation={evaluation}
            evidence={evidence}
            contentItems={contentItems}
            angles={angles}
          />
        )}
      </Modal>
    </div>
  );
}
