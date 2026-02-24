'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag } from '@/components/ui/Badge';
import { pipelineStageColor, stageLabel, formatDateTime } from '@/lib/utils';
import Drawer from '@/components/ui/Drawer';
import EvidenceCard from '@/components/ui/EvidenceCard';
import RubricBars from '@/components/ui/RubricBars';

interface CC {
  id: string; creator_id: string; creator_name: string; pipeline_stage: string;
  scoring_status: string; overall_score: number | null; evidence_coverage: string | null;
  needs_manual_review: boolean | null; evaluated_at: string | null;
}

interface Evaluation {
  id: string; overall_score: number; evidence_coverage: string; needs_manual_review: boolean;
  needs_manual_review_reason: string | null; evaluated_at: string; rationale_md: string;
  score_technical_relevance: number; score_audience_alignment: number; score_content_quality: number;
  score_channel_performance: number; score_brand_fit: number;
  strengths_json: string[]; weaknesses_json: string[];
}

interface Props {
  campaign: { id: string };
  campaignCreators: CC[];
  [key: string]: unknown;
}

export default function ScoringTab({ campaign, campaignCreators }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCc, setSelectedCc] = useState<CC | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evidence, setEvidence] = useState<unknown[]>([]);
  const [angles, setAngles] = useState<unknown[]>([]);
  const [loadingEval, setLoadingEval] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const router = useRouter();
  const { addToast } = useToast();

  const loadEvaluation = async (cc: CC) => {
    setSelectedCc(cc);
    setDrawerOpen(true);
    setLoadingEval(true);
    try {
      const res = await fetch(`/api/evaluations/${cc.id}`);
      const data = await res.json();
      setEvaluation(data.evaluation);
      setEvidence(data.evidence || []);
      setAngles(data.angles || []);
    } finally {
      setLoadingEval(false);
    }
  };

  const runScoring = async (cc: CC) => {
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

  const scoredCcs = (campaignCreators as CC[]).filter(cc => cc.scoring_status === 'scored' || cc.overall_score !== null);

  return (
    <div className="space-y-4">
      <div className="notice-box">
        <span>Evidence required for all scores and recommendations. Â· Every evidence quote is verified against ingested raw text.</span>
      </div>

      {scoredCcs.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">ð§®</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No scoring runs yet</h3>
          <p className="text-xs text-gray-500 mb-4">Ingest content first, then run AI scoring.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Stage</th>
                  <th>Score</th>
                  <th>Evidence</th>
                  <th>NMR</th>
                  <th>Last Evaluated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(campaignCreators as CC[]).map(cc => (
                  <tr key={cc.id}>
                    <td className="font-medium text-gray-900">{cc.creator_name}</td>
                    <td>
                      <span className={`badge text-xs ${pipelineStageColor(cc.pipeline_stage)}`}>
                        {stageLabel(cc.pipeline_stage)}
                      </span>
                    </td>
                    <td><ScorePill score={cc.overall_score} showBar /></td>
                    <td><CoverageTag coverage={cc.evidence_coverage || 'none'} /></td>
                    <td>
                      {cc.needs_manual_review ? (
                        <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">â  NMR</span>
                      ) : cc.overall_score !== null ? (
                        <span className="badge bg-green-50 text-green-700 border-green-200 text-xs">â OK</span>
                      ) : (
                        <span className="text-gray-400 text-xs">â</span>
                      )}
                    </td>
                    <td className="text-xs text-gray-400">{formatDateTime(cc.evaluated_at)}</td>
                    <td>
                      <div className="flex gap-1">
                        {cc.overall_score !== null && (
                          <button onClick={() => loadEvaluation(cc)} className="btn-secondary text-xs py-1 px-2">
                            View
                          </button>
                        )}
                        <button
                          onClick={() => runScoring(cc)}
                          disabled={scoringId === cc.id}
                          className="btn-primary text-xs py-1 px-2"
                        >
                          {scoringId === cc.id ? <span className="animate-spin inline-block">â³</span> : 'â¶ Score'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evaluation Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Evaluation: ${selectedCc?.creator_name || ''}`} width="w-[600px]">
        {loadingEval ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="animate-spin text-2xl">â³</div>
          </div>
        ) : !evaluation ? (
          <div className="p-4 text-center text-gray-400">
            <p className="text-sm">No evaluation found.</p>
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
                <p className="text-xs font-semibold text-orange-800">â  Needs Manual Review</p>
                <p className="text-xs text-orange-700 mt-0.5">{evaluation.needs_manual_review_reason}</p>
              </div>
            )}

            {/* Strengths */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Strengths</h4>
              <ul className="space-y-1">
                {(evaluation.strengths_json || []).map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-green-500 flex-shrink-0 mt-0.5">â</span>{s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weaknesses */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Weaknesses</h4>
              <ul className="space-y-1">
                {(evaluation.weaknesses_json || []).map((w: string, i: number) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">Ã</span>{w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Evidence */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Evidence Snippets ({(evidence as unknown[]).length})
              </h4>
              <p className="text-xs text-gray-400 mb-2">Evidence required for all scores and recommendations.</p>
              <div className="space-y-2">
                {(evidence as { quote: string; url: string; title: string; platform: string; timestamp_start_seconds: number | null; timestamp_end_seconds: number | null; dimension: string; why_it_matters: string; published_at: string }[]).map((ev, i) => (
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
            {(angles as { title: string; format: string; persona: string; key_points_json: string[] }[]).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Content Angles</h4>
                <div className="space-y-2">
                  {(angles as { title: string; format: string; persona: string; key_points_json: string[] }[]).map((angle, i) => (
                    <div key={i} className="bg-gray-50 rounded-md p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-900">{angle.title}</span>
                        <span className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{angle.format}</span>
                        {angle.persona && <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">{angle.persona}</span>}
                      </div>
                      <ul className="space-y-0.5">
                        {(Array.isArray(angle.key_points_json) ? angle.key_points_json : []).map((kp: string, j: number) => (
                          <li key={j} className="text-xs text-gray-600">Â· {kp}</li>
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
