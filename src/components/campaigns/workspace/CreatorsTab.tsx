'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag } from '@/components/ui/Badge';
import { pipelineStageColor, stageLabel, formatDate, formatDateTime } from '@/lib/utils';
import Drawer from '@/components/ui/Drawer';
import EvidenceCard from '@/components/ui/EvidenceCard';
import { RubricBars } from '@/components/ui/ScorePill';
import { useRole } from '@/components/layout/Shell';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Helpers ───

/** Safely parse a jsonb field that may arrive as a string or already-parsed array.
 *  Handles nested objects by extracting their text/title or stringifying. */
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

interface PipelineJob {
  id: string; status: string; error_message: string | null;
  started_at: string | null; finished_at: string | null;
}

interface PipelineEvent {
  level: string; message: string; created_at: string;
}

interface Props {
  campaign: { id: string; stage: string };
  campaignCreators: CampaignCreator[];
  pipelineJob?: PipelineJob | null;
  [key: string]: unknown;
}

// ─── Pipeline Progress ───

function PipelineProgress({ campaignId, initialJob }: { campaignId: string; initialJob?: PipelineJob | null }) {
  const router = useRouter();
  const [job, setJob] = useState<PipelineJob | null>(initialJob || null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [stage, setStage] = useState<string>('');
  const [stale, setStale] = useState(false);
  const [wasRunning, setWasRunning] = useState(initialJob?.status === 'queued' || initialJob?.status === 'running');

  const isRunning = job?.status === 'queued' || job?.status === 'running';

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pipeline-status`);
      const data = await res.json();
      setStage(data.stage);
      if (data.job) {
        setJob(data.job);
        // Detect stale jobs: running for more than 10 minutes
        if ((data.job.status === 'queued' || data.job.status === 'running') && data.job.started_at) {
          const elapsed = Date.now() - new Date(data.job.started_at).getTime();
          if (elapsed > 10 * 60 * 1000) setStale(true);
        } else {
          setStale(false);
        }
      }
      if (data.events) setEvents(data.events);
    } catch { /* ignore */ }
  }, [campaignId]);

  // When pipeline transitions from running → completed/failed, refresh server data
  useEffect(() => {
    if (wasRunning && !isRunning) {
      router.refresh();
    }
    setWasRunning(isRunning);
  }, [isRunning, wasRunning, router]);

  useEffect(() => {
    poll();
    if (!isRunning) return;
    // Poll slower when stale (every 30s vs 5s) but don't stop
    const interval = setInterval(poll, stale ? 30000 : 5000);
    return () => clearInterval(interval);
  }, [isRunning, stale, poll]);

  if (!job) return null;

  const STEPS = [
    { key: 'discovery', label: 'Discovery' },
    { key: 'ingestion', label: 'Pre-qualify' },
    { key: 'scoring', label: 'Scoring' },
  ];

  const stageIndex = STEPS.findIndex(s => s.key === stage);
  const doneIndex = job.status === 'completed' ? STEPS.length : stageIndex;

  return (
    <div className={`card p-4 border-l-4 ${
      job.status === 'failed' ? 'border-l-red-400' :
      isRunning ? 'border-l-blue-400' :
      'border-l-green-500'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Pipeline Progress</h3>
        <span className={`badge text-xs ${
          job.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
          job.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
          stale ? 'bg-amber-50 text-amber-700 border-amber-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {stale ? 'Stalled' : job.status === 'running' ? 'Running…' : job.status}
        </span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 mb-3">
        {STEPS.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium w-full justify-center ${
              i < doneIndex ? 'bg-green-100 text-green-700' :
              i === doneIndex && isRunning ? 'bg-blue-100 text-blue-700 animate-pulse' :
              'bg-gray-100 text-gray-400'
            }`}>
              <span>{i < doneIndex ? '\u2713' : String(i + 1)}</span>
              <span>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-gray-200 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Error */}
      {job.status === 'failed' && job.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-2">
          <p className="text-xs text-red-700">{job.error_message}</p>
        </div>
      )}

      {/* Stale warning */}
      {stale && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 mb-2">
          <p className="text-xs text-amber-700">Pipeline appears stalled (running &gt; 10 min). Try re-running.</p>
        </div>
      )}

      {/* Events log */}
      {events.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-0.5 bg-gray-50 rounded-md p-2">
          {events.map((ev, i) => (
            <div key={i} className={`text-xs flex gap-2 ${
              ev.level === 'error' ? 'text-red-600' :
              ev.level === 'warn' ? 'text-amber-600' :
              'text-gray-600'
            }`}>
              <span className="text-gray-400 flex-shrink-0 font-mono">
                {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span>{ev.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───

export default function CreatorsTab({ campaign, campaignCreators, pipelineJob }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCc, setSelectedCc] = useState<CampaignCreator | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evidence, setEvidence] = useState<EvidenceSnippet[]>([]);
  const [angles, setAngles] = useState<ContentAngle[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [addUrl, setAddUrl] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [stageFilter, setStageFilter] = useState('all');
  const [creatorsPage, setCreatorsPage] = useState(1);
  const CREATORS_PAGE_SIZE = 25;
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  // Auto-refresh while pipeline is running
  const isRunning = pipelineJob?.status === 'queued' || pipelineJob?.status === 'running';
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(interval);
  }, [isRunning, router]);

  const filteredCreators = (campaignCreators as CampaignCreator[]).filter(cc => {
    if (!showExcluded && cc.pipeline_stage === 'excluded') return false;
    if (stageFilter !== 'all' && cc.pipeline_stage !== stageFilter) return false;
    return true;
  });
  const creatorsTotalPages = Math.max(1, Math.ceil(filteredCreators.length / CREATORS_PAGE_SIZE));
  const pagedCreators = filteredCreators.slice((creatorsPage - 1) * CREATORS_PAGE_SIZE, creatorsPage * CREATORS_PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => { setCreatorsPage(1); }, [showExcluded, stageFilter]);

  const loadEvaluation = async (cc: CampaignCreator) => {
    setSelectedCc(cc);
    setDrawerOpen(true);
    setLoadingEval(true);
    try {
      const res = await fetch(`/api/evaluations/${cc.id}`);
      const data = await res.json();
      setEvaluation(data.evaluation);
      setEvidence(data.evidenceSnippets || data.evidence || []);
      setAngles(data.contentAngles || data.angles || []);
      setContentItems(data.contentItems || []);
    } finally {
      setLoadingEval(false);
    }
  };

  const runScoring = async (cc: CampaignCreator) => {
    setScoringId(cc.id);
    try {
      const res = await fetch('/api/ai/score-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_creator_id: cc.id }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Scored ${cc.creator_name}: ${data.overall_score}/100`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Scoring failed');
      }
    } finally {
      setScoringId(null);
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

  const handleReRunPipeline = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/run-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Pipeline re-started');
        router.refresh();
      } else {
        addToast('error', data.error || 'Failed to start pipeline');
      }
    } catch (e) {
      addToast('error', (e as Error).message);
    }
  };

  const handleFindCreators = async () => {
    setDiscovering(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Found ${data.total_linked} creators (${data.db_matched} from DB, ${data.llm_suggested} from AI)`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Discovery failed');
      }
    } catch (e) {
      addToast('error', (e as Error).message);
    } finally {
      setDiscovering(false);
    }
  };

  const stages = Array.from(new Set(campaignCreators.map(cc => cc.pipeline_stage)));

  return (
    <div className="space-y-4">
      {/* Pipeline Progress */}
      <PipelineProgress campaignId={campaign.id} initialJob={pipelineJob} />

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input type="checkbox" checked={showExcluded} onChange={e => setShowExcluded(e.target.checked)} className="rounded" />
          <span className="text-gray-700">Show excluded</span>
        </label>
        <select
          className="select-field text-xs py-1 px-2"
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
        >
          <option value="all">All stages</option>
          {stages.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
        </select>
        <div className="flex-1" />
        <div className="flex gap-2">
          <input
            className="input-field w-64 text-xs"
            value={addUrl}
            onChange={e => setAddUrl(e.target.value)}
            placeholder="Add creator by YouTube URL…"
            onKeyDown={e => { if (e.key === 'Enter') handleAddCreatorUrl(); }}
          />
          <button onClick={handleAddCreatorUrl} disabled={addLoading} className="btn-secondary text-xs">
            {addLoading ? '…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Manual actions */}
      <div className="flex gap-2">
        <button onClick={handleFindCreators} disabled={discovering} className="btn-primary text-xs">
          {discovering ? 'Discovering...' : 'Find Creators'}
        </button>
        <button onClick={handleReRunPipeline} className="btn-secondary text-xs">
          Re-run Pipeline
        </button>
      </div>

      {/* Creators table */}
      {pagedCreators.length === 0 ? (
        <div className="card">
          <EmptyState
            icon=""
            title={isRunning ? 'Pipeline is running…' : 'No creators yet'}
            description={isRunning ? 'Creators will appear as the pipeline discovers and scores them.' : 'Click "Find Creators" to discover creators from the database and AI, or add one manually by URL.'}
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">{filteredCreators.length} creator{filteredCreators.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platform</th>
                  <th>Pipeline Stage</th>
                  <th>Score</th>
                  <th>Evidence</th>
                  <th>NMR</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedCreators.map(cc => (
                  <tr key={cc.id}>
                    <td>
                      <button
                        className="font-medium text-gray-900 hover:text-accent text-left"
                        onClick={() => loadEvaluation(cc)}
                      >
                        {cc.creator_name}
                      </button>
                      {cc.creator_handle && (
                        <div className="text-xs text-gray-400">{cc.creator_handle}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-gray-100 text-gray-600 border-gray-200 text-xs">{cc.creator_platform}</span>
                    </td>
                    <td>
                      <span className={`badge text-xs ${pipelineStageColor(cc.pipeline_stage)}`}>
                        {stageLabel(cc.pipeline_stage)}
                      </span>
                    </td>
                    <td>{cc.overall_score != null ? <ScorePill score={cc.overall_score} showBar /> : <span className="text-gray-400">—</span>}</td>
                    <td>{cc.overall_score != null ? <CoverageTag coverage={cc.evidence_coverage || 'none'} /> : <span className="text-gray-400">—</span>}</td>
                    <td>
                      {cc.needs_manual_review ? (
                        <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">{'\u26A0'} NMR</span>
                      ) : cc.overall_score !== null ? (
                        <span className="badge bg-green-50 text-green-700 border-green-200 text-xs">{'\u2713'} OK</span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {cc.overall_score !== null && (
                          <button onClick={() => loadEvaluation(cc)} className="btn-secondary text-xs py-1 px-2">
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {creatorsTotalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">Page {creatorsPage} of {creatorsTotalPages}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setCreatorsPage(p => Math.max(1, p - 1))} disabled={creatorsPage <= 1} className="p-1 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => setCreatorsPage(p => Math.min(creatorsTotalPages, p + 1))} disabled={creatorsPage >= creatorsTotalPages} className="p-1 text-gray-500 hover:bg-gray-200 rounded disabled:opacity-30">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Evaluation: ${selectedCc?.creator_name || ''}`} width="w-[600px]">
        {loadingEval ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="animate-spin text-2xl">{'\u27F3'}</div>
          </div>
        ) : !evaluation ? (
          <div className="p-4 text-center text-gray-400">
            <p className="text-sm">{selectedCc?.overall_score === null ? 'Not scored yet.' : 'No evaluation found.'}</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Scores */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900">Overall Score</span>
                <ScorePill score={evaluation.overall_score} size="md" showBar />
              </div>
              <RubricBars scores={{
                score_technical_relevance: evaluation.score_technical_relevance,
                score_audience_alignment: evaluation.score_audience_alignment,
                score_content_quality: evaluation.score_content_quality,
                score_channel_performance: evaluation.score_channel_performance,
                score_brand_fit: evaluation.score_brand_fit,
              }} />
            </div>

            {/* NMR Warning */}
            {evaluation.needs_manual_review && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <p className="text-xs font-semibold text-orange-800">{'\u26A0'} Needs Manual Review</p>
                <p className="text-xs text-orange-700 mt-0.5">{evaluation.needs_manual_review_reason}</p>
              </div>
            )}

            {/* Strengths */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Strengths</h4>
              <ul className="space-y-1">
                {(parseJsonArray(evaluation.strengths_json)).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-green-500 flex-shrink-0 mt-0.5">{'\u2713'}</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Weaknesses</h4>
              <ul className="space-y-1">
                {(parseJsonArray(evaluation.weaknesses_json)).map((w: string, i: number) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">{'\u00D7'}</span>{w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Content Evaluated */}
            {contentItems.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  Content Evaluated ({contentItems.length})
                </h4>
                <div className="space-y-1.5">
                  {contentItems.map(ci => (
                    <div key={ci.id} className="flex items-center gap-2 text-xs">
                      <span className="badge bg-gray-100 text-gray-600 border-gray-200 text-[10px] shrink-0">{ci.platform}</span>
                      <a
                        href={ci.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate"
                        title={ci.title}
                      >
                        {ci.title}
                      </a>
                      {ci.published_at && (
                        <span className="text-gray-400 shrink-0">{formatDate(ci.published_at)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Evidence Snippets ({evidence.length})
              </h4>
              <div className="space-y-2">
                {evidence.map((ev, i) => (
                  <EvidenceCard
                    key={i}
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
            </div>

            {/* Content Angles */}
            {angles.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Content Angles</h4>
                <div className="space-y-2">
                  {angles.map((angle, i) => (
                    <div key={i} className="bg-gray-50 rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-900">{angle.title}</span>
                        <span className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{angle.format}</span>
                        {angle.persona && <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">{angle.persona}</span>}
                      </div>
                      <ul className="space-y-0.5">
                        {parseJsonArray(angle.key_points_json).map((kp: string, j: number) => (
                          <li key={j} className="text-xs text-gray-600">{'\u00B7'} {kp}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
