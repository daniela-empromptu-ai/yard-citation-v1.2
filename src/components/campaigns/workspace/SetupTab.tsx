'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { formatDateTime, stageLabel } from '@/lib/utils';

interface Props {
  campaign: {
    id: string; name: string; stage: string; geo_targets: string[];
    product_category: string; creative_brief: string; language: string; client_name: string;
    personas: string[]; gumshoe_notes: string | null;
  };
  topics: { id: string; topic: string; source: string; confidence: number | null; rationale: string | null; approved: boolean }[];
  campaignCreators: { pipeline_stage: string; scoring_status: string }[];
  activityLog: { id: string; event_type: string; actor_name?: string | null; created_at: string; event_data_json: Record<string, unknown> }[];
  [key: string]: unknown;
}

export default function SetupTab({ campaign, topics, campaignCreators, activityLog }: Props) {
  const [showMd, setShowMd] = useState(true);

  const total = campaignCreators.length;
  const scored = campaignCreators.filter(cc => cc.scoring_status === 'scored').length;
  const discovered = campaignCreators.filter(cc => cc.pipeline_stage === 'discovered').length;

  const nextActions: string[] = [];
  if (campaign.stage === 'draft') nextActions.push('Generate and approve search terms');
  if (campaign.stage === 'terms') nextActions.push('Review and approve search terms to trigger creator discovery');
  if (campaign.stage === 'discovery') nextActions.push('Review discovered creators and score them');
  if (campaignCreators.filter(cc => cc.scoring_status === 'scored').length > 0) nextActions.push('Review scored creators');

  const personas = Array.isArray(campaign.personas) ? campaign.personas : [];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Creators', value: total, color: 'text-slate-200' },
          { label: 'Discovered', value: discovered, color: 'text-cyan-400' },
          { label: 'Scored', value: scored, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5 items-stretch">
        {/* Campaign Summary */}
        <div className="card p-4 flex flex-col">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Campaign Summary</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-slate-500">Client</dt>
              <dd className="text-slate-200 font-medium">{campaign.client_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Stage</dt>
              <dd><span className="badge bg-purple-900/30 text-purple-400 border-purple-700/50">{stageLabel(campaign.stage)}</span></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Language</dt>
              <dd className="text-slate-200">{campaign.language}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Category</dt>
              <dd className="text-slate-200 text-right max-w-32 truncate">{campaign.product_category || '\u2014'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">GEO</dt>
              <dd className="text-slate-200">{(campaign.geo_targets as unknown as string[] || []).join(', ')}</dd>
            </div>
          </dl>

          <div className="mt-3 pt-3 border-t border-[#2d3748]">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Personas</p>
            <div className="flex flex-wrap gap-1">
              {personas.length === 0 ? (
                <span className="text-xs text-slate-500 italic">None</span>
              ) : personas.map(p => (
                <span key={p} className="badge bg-purple-900/30 text-purple-400 border-purple-700/50 text-xs">{p}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#2d3748]">
            <p className="text-xs font-medium text-slate-400 mb-1.5">Topics</p>
            <div className="flex flex-wrap gap-1">
              {topics.length === 0 ? (
                <span className="text-xs text-slate-500 italic">None</span>
              ) : topics.filter(t => t.approved).map(tp => (
                <span key={tp.id} className="badge bg-teal-900/30 text-teal-400 border-teal-700/50 text-xs">{tp.topic}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Next Actions + Recent Activity */}
        <div className="flex flex-col gap-5">
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Next Actions</h3>
            {nextActions.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No pending actions — campaign is up to date.</p>
            ) : (
              <ol className="space-y-2">
                {nextActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i+1}</span>
                    <span className="text-slate-300">{action}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card p-4 flex-1 flex flex-col">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recent Activity</h3>
            {activityLog.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activityLog.slice(0, 6).map(al => (
                  <div key={al.id} className="text-xs">
                    <span className="text-slate-200 font-medium">{al.event_type.replace(/_/g, ' ')}</span>
                    {al.actor_name && <span className="text-slate-500"> by {al.actor_name}</span>}
                    <div className="text-slate-600">{formatDateTime(al.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Creative Brief */}
        <div className="flex flex-col gap-5">
          <div className="card overflow-hidden flex flex-col flex-1">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3748] bg-[#111827]">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Creative Brief</h3>
              <button onClick={() => setShowMd(!showMd)} className="btn-ghost text-xs">
                {showMd ? 'Raw' : 'Formatted'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {showMd ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{campaign.creative_brief || '_No brief provided_'}</ReactMarkdown>
                </div>
              ) : (
                <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{campaign.creative_brief || 'No brief provided'}</pre>
              )}
            </div>
          </div>

          {campaign.gumshoe_notes && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2d3748] bg-[#111827]">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Gumshoe Report</h3>
              </div>
              <div className="p-4">
                <a
                  href={campaign.gumshoe_notes}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline break-all"
                >
                  {campaign.gumshoe_notes}
                </a>
                <p className="text-xs text-slate-500 mt-1">Cited creators are extracted automatically during discovery.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
