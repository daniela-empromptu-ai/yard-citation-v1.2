'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate, formatDateTime, formatNumber, outreachStateColor, stageLabel } from '@/lib/utils';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag, FlagBadge, PlatformBadge } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const TABS = ['Summary', 'Platforms', 'Content', 'Evidence', 'History', 'Notes'];

interface Props {
  creator: { id: string; display_name: string; primary_handle: string | null; bio: string | null;
    topics: string[]; languages: string[]; geo_focus: string[];
    is_dormant: boolean; is_autodubbed_suspected: boolean; competitor_affiliated: boolean;
    last_content_date: string | null; };
  platforms: { id: string; platform: string; handle: string | null; url: string; follower_count: number | null; }[];
  flags: { id: string; flag: string; is_active: boolean; reason: string | null; set_by_name: string; set_at: string; }[];
  pricing: { id: string; price_type: string; price_amount_usd: number; is_too_high: boolean; notes: string | null; }[];
  notes: { id: string; note_md: string; created_by_name: string; created_at: string; }[];
  content: { id: string; title: string; url: string; platform: string; content_type: string; word_count: number | null; published_at: string | null; metadata_json: Record<string, unknown>; }[];
  evaluations: { id: string; overall_score: number; evidence_coverage: string; evaluated_at: string; campaign_name: string; campaign_id: string; pipeline_stage: string; }[];
  campaigns: { id: string; campaign_id: string; campaign_name: string; client_name: string; pipeline_stage: string; outreach_state: string; created_at: string; }[];
}

export default function CreatorProfileClient({ creator, platforms, flags, pricing, notes, content, evaluations, campaigns }: Props) {
  const [tab, setTab] = useState('Summary');
  const [piiModal, setPiiModal] = useState(false);
  const [piiRevealed, setPiiRevealed] = useState(false);
  const { addToast } = useToast();

  const activeFlags = flags.filter(f => f.is_active);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-accent-light flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">
            {creator.display_name[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{creator.display_name}</h1>
            {creator.primary_handle && <p className="text-sm text-gray-500">{creator.primary_handle}</p>}
            <div className="flex items-center gap-2 mt-1.5">
              {creator.is_dormant && <span className="badge bg-gray-100 text-gray-600 border-gray-200 text-xs">ð¤ Dormant</span>}
              {creator.is_autodubbed_suspected && <span className="badge bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">ð¤ Autodub?</span>}
              {creator.competitor_affiliated && <span className="badge bg-red-50 text-red-700 border-red-200 text-xs">ð« Competitor</span>}
              {activeFlags.map(f => <FlagBadge key={f.id} flag={f.flag} />)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Last content: {formatDate(creator.last_content_date)}</p>
          <button className="btn-secondary text-xs mt-1" onClick={() => setPiiModal(true)}>
            ð Reveal Contact Info
          </button>
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

      {/* Summary Tab */}
      {tab === 'Summary' && (
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 space-y-4">
            {creator.bio && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Bio</h3>
                <p className="text-sm text-gray-700">{creator.bio}</p>
              </div>
            )}
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Topics</h3>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(creator.topics) ? creator.topics : []).map(tp => (
                  <span key={tp} className="badge bg-teal-50 text-teal-700 border-teal-200 text-xs">{tp}</span>
                ))}
              </div>
            </div>
            {pricing.length > 0 && (
              <div className="card p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Pricing</h3>
                <div className="space-y-1">
                  {pricing.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 capitalize">{p.price_type}</span>
                      <span className="text-sm font-mono text-gray-900">${Number(p.price_amount_usd).toLocaleString()}</span>
                      {p.is_too_high && <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">Too High</span>}
                      {p.notes && <span className="text-xs text-gray-400">Â· {p.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Languages</h3>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(creator.languages) ? creator.languages : []).map(l => (
                  <span key={l} className="badge bg-blue-50 text-blue-700 border-blue-200 text-xs">{l}</span>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">GEO Focus</h3>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(creator.geo_focus) ? creator.geo_focus : []).map(g => (
                  <span key={g} className="badge bg-gray-100 text-gray-600 border-gray-200 text-xs">{g}</span>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Campaign History</h3>
              <p className="text-sm text-gray-700">{campaigns.length} campaigns</p>
            </div>
          </div>
        </div>
      )}

      {/* Platforms Tab */}
      {tab === 'Platforms' && (
        <div className="grid grid-cols-2 gap-3">
          {platforms.map(p => (
            <div key={p.id} className="card p-4 flex items-center gap-3">
              <PlatformBadge platform={p.platform} />
              <div className="flex-1 min-w-0">
                {p.handle && <p className="text-sm font-medium text-gray-900">{p.handle}</p>}
                <a href={p.url} target="_blank" rel="noopener" className="text-xs text-accent hover:underline truncate block">{p.url}</a>
              </div>
              {p.follower_count && (
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatNumber(p.follower_count)}</p>
                  <p className="text-xs text-gray-400">followers</p>
                </div>
              )}
            </div>
          ))}
          {platforms.length === 0 && <p className="text-sm text-gray-400">No platforms on record.</p>}
        </div>
      )}

      {/* Content Tab */}
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
                  <td className="text-xs font-mono">{ci.word_count?.toLocaleString() || 'â'}</td>
                  <td className="text-xs font-mono">{ci.metadata_json?.view_count ? formatNumber(Number(ci.metadata_json.view_count)) : 'â'}</td>
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

      {/* Evidence Tab */}
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

      {/* History Tab */}
      {tab === 'History' && (
        <div className="card overflow-hidden">
          <table className="w-full table-dense">
            <thead>
              <tr><th>Campaign</th><th>Client</th><th>Stage</th><th>Outreach State</th><th>Added</th></tr>
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
                  <td>
                    <span className={`badge text-xs ${outreachStateColor(cc.outreach_state)}`}>{stageLabel(cc.outreach_state)}</span>
                  </td>
                  <td className="text-xs text-gray-400">{formatDate(cc.created_at)}</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No campaign history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes Tab */}
      {tab === 'Notes' && (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="card p-4">
              <p className="text-sm text-gray-800">{n.note_md}</p>
              <p className="text-xs text-gray-400 mt-1">â {n.created_by_name} Â· {formatDateTime(n.created_at)}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-sm text-gray-400">No notes. Add notes during campaign review.</p>}
        </div>
      )}

      {/* PII Modal */}
      <Modal open={piiModal} onClose={() => setPiiModal(false)} title="Reveal Contact Information" size="sm">
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-xs font-semibold text-amber-800">â  PII Warning</p>
            <p className="text-xs text-amber-700 mt-0.5">Accessing contact information is logged. Only access when necessary for outreach.</p>
          </div>
          {!piiRevealed ? (
            <button
              className="btn-danger w-full"
              onClick={() => {
                setPiiRevealed(true);
                addToast('info', 'PII access logged');
              }}
            >
              ð Confirm â Reveal Contact Info
            </button>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-gray-500">Email: <strong className="text-gray-900 font-mono">[encrypted â decode server-side]</strong></p>
              <p className="text-xs text-gray-400">Contact information is stored encrypted. Reveal through the outreach workflow.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
