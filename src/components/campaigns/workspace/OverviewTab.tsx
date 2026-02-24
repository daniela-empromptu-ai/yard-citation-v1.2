'use client';

import Link from 'next/link';
import { formatDateTime, stageLabel } from '@/lib/utils';

interface Props {
  campaign: { id: string; name: string; stage: string; geo_targets: string[]; product_category: string; language: string; client_name: string };
  personas: { persona_name: string }[];
  topics: { topic: string; approved: boolean }[];
  campaignCreators: { pipeline_stage: string; scoring_status: string; outreach_state: string }[];
  activityLog: { id: string; event_type: string; actor_name?: string | null; created_at: string; event_data_json: Record<string, unknown> }[];
  [key: string]: unknown;
}

export default function OverviewTab({ campaign, personas, topics, campaignCreators, activityLog }: Props) {
  const total = campaignCreators.length;
  const ingested = campaignCreators.filter(cc => cc.scoring_status !== 'not_scored').length;
  const scored = campaignCreators.filter(cc => cc.scoring_status === 'scored').length;
  const outreachReady = campaignCreators.filter(cc => cc.pipeline_stage === 'outreach_ready').length;
  const sent = campaignCreators.filter(cc => ['sent','replied','booked'].includes(cc.outreach_state)).length;
  const booked = campaignCreators.filter(cc => cc.outreach_state === 'booked').length;
  const bookingRate = sent > 0 ? Math.round((booked / sent) * 100) : 0;

  const nextActions: string[] = [];
  if (campaignCreators.filter(cc => cc.pipeline_stage === 'discovered').length > 0) nextActions.push('Ingest content for discovered creators');
  if (campaignCreators.filter(cc => cc.pipeline_stage === 'ingested' && cc.scoring_status === 'not_scored').length > 0) nextActions.push('Run AI scoring for ingested creators');
  if (campaignCreators.filter(cc => cc.pipeline_stage === 'needs_manual_review').length > 0) nextActions.push('Review creators flagged for manual review');
  if (campaignCreators.filter(cc => cc.pipeline_stage === 'scored').length > 0) nextActions.push('Qualifier: review and approve scored creators');
  if (campaignCreators.filter(cc => cc.pipeline_stage === 'outreach_ready' && cc.outreach_state === 'not_started').length > 0) nextActions.push('Generate outreach packets for approved creators');

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total Creators', value: total, color: 'text-gray-700' },
          { label: 'Ingested', value: ingested, color: 'text-blue-700' },
          { label: 'Scored', value: scored, color: 'text-purple-700' },
          { label: 'Outreach Ready', value: outreachReady, color: 'text-green-700' },
          { label: 'Emails Sent', value: sent, color: 'text-teal-700' },
          { label: 'Booking Rate', value: `${bookingRate}%`, color: booked > 0 ? 'text-emerald-700' : 'text-gray-500' },
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
              <dd className="text-gray-900 text-right max-w-32 truncate">{campaign.product_category || 'â'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">GEO</dt>
              <dd className="text-gray-900">{(campaign.geo_targets as unknown as string[] || []).join(', ')}</dd>
            </div>
          </dl>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Personas</p>
            <div className="flex flex-wrap gap-1">
              {personas.map(p => (
                <span key={p.persona_name} className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">{p.persona_name}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600 mb-1.5">Topics</p>
            <div className="flex flex-wrap gap-1">
              {topics.filter(t => t.approved).map(tp => (
                <span key={tp.topic} className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{tp.topic}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Next Actions */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Next Actions</h3>
          {nextActions.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No pending actions â campaign is up to date.</p>
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

        {/* Recent Activity */}
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Recent Activity</h3>
          {activityLog.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {activityLog.slice(0, 8).map(al => (
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
    </div>
  );
}
