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
          { label: 'Total Creators', value: total, color: 'text-gray-700' },
          { label: 'Discovered', value: discovered, color: 'text-cyan-700' },
          { label: 'Scored', value: scored, color: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Campaign Summary */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Campaign Summary</h3>
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-500">Client</dt>
              <dd className="text-gray-900 font-medium">{campaign.client_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Stage</dt>
              <dd><span className="badge bg-purple-50 text-purple-700 border-purple-200">{stageLabel(campaign.stage)}</span></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Language</dt>
              <dd className="text-gray-900">{campaign.language}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Category</dt>
              <dd className="text-gray-900 text-right max-w-32 truncate">{campaign.product_category || '\u2014'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">GEO</dt>
              <dd className="text-gray-900">{(campaign.geo_targets as unknown as string[] || []).join(', ')}</dd>
            </div>
          </dl>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Personas</p>
            <div className="flex flex-wrap gap-1">
              {personas.length === 0 ? (
                <span className="text-xs text-gray-400 italic">None</span>
              ) : personas.map(p => (
                <span key={p} className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">{p}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Topics</p>
            <div className="flex flex-wrap gap-1">
              {topics.length === 0 ? (
                <span className="text-xs text-gray-400 italic">None</span>
              ) : topics.filter(t => t.approved).map(tp => (
                <span key={tp.id} className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{tp.topic}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Next Actions + Recent Activity */}
        <div className="space-y-5">
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Next Actions</h3>
            {nextActions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No pending actions — campaign is up to date.</p>
            ) : (
              <ol className="space-y-2">
                {nextActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i+1}</span>
                    <span className="text-gray-700">{action}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Recent Activity</h3>
            {activityLog.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activityLog.slice(0, 6).map(al => (
                  <div key={al.id} className="text-xs">
                    <span className="text-gray-800 font-medium">{al.event_type.replace(/_/g, ' ')}</span>
                    {al.actor_name && <span className="text-gray-500"> by {al.actor_name}</span>}
                    <div className="text-gray-400">{formatDateTime(al.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Creative Brief */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Creative Brief</h3>
              <button onClick={() => setShowMd(!showMd)} className="btn-ghost text-xs">
                {showMd ? 'Raw' : 'Formatted'}
              </button>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto">
              {showMd ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{campaign.creative_brief || '_No brief provided_'}</ReactMarkdown>
                </div>
              ) : (
                <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{campaign.creative_brief || 'No brief provided'}</pre>
              )}
            </div>
          </div>

          {campaign.gumshoe_notes && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Gumshoe Report</h3>
              </div>
              <div className="p-4">
                {campaign.gumshoe_notes.startsWith('http') ? (
                  <a
                    href={campaign.gumshoe_notes}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline break-all"
                  >
                    {campaign.gumshoe_notes}
                  </a>
                ) : (
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap">{campaign.gumshoe_notes}</pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
