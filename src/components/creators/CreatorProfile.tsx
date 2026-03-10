'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate, formatDateTime, formatNumber, stageLabel } from '@/lib/utils';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag, PlatformBadge } from '@/components/ui/Badge';

const TABS = ['Summary', 'Content', 'Evidence', 'History'];

interface Creator {
  id: string; name: string; platform: string; handle: string | null; url: string | null;
  subscriber_count: number | null; content_language: string | null;
  relationship_status: string | null; too_expensive: boolean; brand_owned: boolean;
  excluded: boolean; exclusion_reason: string | null; notes: string | null;
  email: string | null; contact_method: string | null; discovered_via: string | null;
}

interface Props {
  creator: Creator;
  categories: { id: string; name: string }[];
  content: { id: string; title: string; url: string; platform: string; content_type: string; word_count: number | null; published_at: string | null; metadata_json: Record<string, unknown>; }[];
  evaluations: { id: string; overall_score: number; evidence_coverage: string; evaluated_at: string; campaign_name: string; campaign_id: string; pipeline_stage: string; }[];
  campaigns: { id: string; campaign_id: string; campaign_name: string; client_name: string; pipeline_stage: string; created_at: string; }[];
}

function RelBadge({ status }: { status: string | null }) {
  const s = status || 'none';
  const c: Record<string, string> = { none: 'bg-slate-100 text-slate-500', cold: 'bg-blue-100 text-blue-700', warm: 'bg-amber-100 text-amber-700', hot: 'bg-red-100 text-red-700' };
  return <span className={`badge text-xs ${c[s] || c.none}`}>{s}</span>;
}

export default function CreatorProfileClient({ creator, categories, content, evaluations, campaigns }: Props) {
  const [tab, setTab] = useState('Summary');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">
            {creator.name[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{creator.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <PlatformBadge platform={creator.platform} />
              {creator.handle && <span className="text-sm text-gray-500">{creator.handle}</span>}
              <RelBadge status={creator.relationship_status} />
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {creator.too_expensive && <span className="badge bg-amber-50 text-amber-700 border-amber-200 text-xs">$$$ Too Expensive</span>}
              {creator.brand_owned && <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs">Brand Owned</span>}
              {creator.excluded && <span className="badge bg-red-50 text-red-700 border-red-200 text-xs">Excluded{creator.exclusion_reason ? `: ${creator.exclusion_reason}` : ''}</span>}
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 space-y-0.5">
          {creator.subscriber_count && <p>{formatNumber(creator.subscriber_count)} subscribers</p>}
          {creator.email && <p>{creator.email}</p>}
          {creator.url && <a href={creator.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline block truncate max-w-[200px]">{creator.url}</a>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* Summary */}
      {tab === 'Summary' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            {categories.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Categories</h3>
                <div className="flex flex-wrap gap-1">
                  {categories.map(cat => (
                    <span key={cat.id} className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{cat.name}</span>
                  ))}
                </div>
              </div>
            )}
            {creator.notes && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Notes</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{creator.notes}</p>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Details</h3>
              <div className="space-y-1.5 text-sm">
                {creator.content_language && <p><span className="text-gray-500">Language:</span> {creator.content_language}</p>}
                {creator.contact_method && <p><span className="text-gray-500">Contact:</span> {creator.contact_method}</p>}
                {creator.discovered_via && <p><span className="text-gray-500">Discovered via:</span> {creator.discovered_via}</p>}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Campaign History</h3>
              <p className="text-sm text-gray-700">{campaigns.length} campaigns</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === 'Content' && (
        <div className="card overflow-hidden">
          <table className="w-full table-dense">
            <thead>
              <tr><th>Title</th><th>Platform</th><th>Words</th><th>Views</th><th>Published</th></tr>
            </thead>
            <tbody>
              {content.map(ci => (
                <tr key={ci.id}>
                  <td>
                    <a href={ci.url} target="_blank" rel="noopener" className="font-medium text-gray-900 hover:text-accent">{ci.title}</a>
                  </td>
                  <td><PlatformBadge platform={ci.platform} /></td>
                  <td className="text-xs font-mono">{ci.word_count?.toLocaleString() || '\u2014'}</td>
                  <td className="text-xs font-mono">{ci.metadata_json?.view_count ? formatNumber(Number(ci.metadata_json.view_count)) : '\u2014'}</td>
                  <td className="text-xs text-gray-500">{formatDate(ci.published_at)}</td>
                </tr>
              ))}
              {content.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No content ingested.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Evidence */}
      {tab === 'Evidence' && (
        <div className="space-y-3">
          {evaluations.map(ev => (
            <div key={ev.id} className="card p-4">
              <div className="flex items-center gap-3 mb-2">
                <Link href={`/campaigns/${ev.campaign_id}`} className="text-sm font-medium text-accent hover:underline">{ev.campaign_name}</Link>
                <ScorePill score={ev.overall_score} />
                <CoverageTag coverage={ev.evidence_coverage} />
                <span className="text-xs text-gray-400">{formatDateTime(ev.evaluated_at)}</span>
              </div>
            </div>
          ))}
          {evaluations.length === 0 && <p className="text-sm text-gray-400">No evaluations on record.</p>}
        </div>
      )}

      {/* History */}
      {tab === 'History' && (
        <div className="card overflow-hidden">
          <table className="w-full table-dense">
            <thead>
              <tr><th>Campaign</th><th>Client</th><th>Stage</th><th>Added</th></tr>
            </thead>
            <tbody>
              {campaigns.map(cc => (
                <tr key={cc.id}>
                  <td>
                    <Link href={`/campaigns/${cc.campaign_id}`} className="font-medium text-gray-900 hover:text-accent">{cc.campaign_name}</Link>
                  </td>
                  <td className="text-gray-600 text-xs">{cc.client_name}</td>
                  <td>
                    <span className="badge bg-gray-100 text-gray-700 border-gray-200 text-xs">{stageLabel(cc.pipeline_stage)}</span>
                  </td>
                  <td className="text-xs text-gray-400">{formatDate(cc.created_at)}</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No campaign history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
