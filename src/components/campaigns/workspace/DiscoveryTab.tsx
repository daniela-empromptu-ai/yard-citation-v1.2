'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDate, pipelineStageColor, stageLabel } from '@/lib/utils';
import { PlatformBadge, FlagBadge } from '@/components/ui/Badge';
import Drawer from '@/components/ui/Drawer';
import { useRole } from '@/components/layout/Shell';

interface CampaignCreator {
  id: string; creator_id: string; creator_name: string; primary_handle: string | null;
  pipeline_stage: string; is_dormant: boolean; is_autodubbed_suspected: boolean;
  competitor_affiliated: boolean; last_content_date: string | null;
  creator_topics: string[]; languages: string[];
}

interface Props {
  campaign: { id: string };
  searchTerms: { id: string; term: string; approved: boolean }[];
  campaignCreators: CampaignCreator[];
  [key: string]: unknown;
}

export default function DiscoveryTab({ campaign, searchTerms, campaignCreators }: Props) {
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState<CampaignCreator | null>(null);
  const [addUrl, setAddUrl] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [filterDormant, setFilterDormant] = useState(true);
  const [filterAutodub, setFilterAutodub] = useState(true);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{ discovered?: number; total_sheet_rows?: number; warnings?: string[] } | null>(null);
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  const approvedTerms = (searchTerms as { id: string; term: string; approved: boolean }[]).filter(t => t.approved);

  const filteredCreators = (campaignCreators as CampaignCreator[]).filter(cc => {
    if (filterDormant && cc.is_dormant) return false;
    if (filterAutodub && cc.is_autodubbed_suspected) return false;
    return true;
  });

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

  const handleScanSheet = async () => {
    setScanLoading(true);
    setScanResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setScanResult({ discovered: data.discovered, total_sheet_rows: data.total_sheet_rows, warnings: data.warnings });
        addToast('success', `Found ${data.discovered} matching creators from ${data.total_sheet_rows} rows`);
        router.refresh();
      } else {
        addToast('error', data.error || 'Scan failed');
      }
    } catch (e) {
      addToast('error', (e as Error).message || 'Scan failed');
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Google Sheet Scan Card */}
      <div className="card p-4 border-l-4 border-l-accent">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Google Sheet Creator Scan</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {scanLoading
                ? 'Scanning sheet and matching creators to campaign topics...'
                : scanResult
                  ? `Found ${scanResult.discovered} matches from ${scanResult.total_sheet_rows} creator rows`
                  : 'Scan the creator database sheet to discover topic-matched creators'}
            </p>
            {scanResult?.warnings && scanResult.warnings.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {scanResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-600">Warning: {w}</p>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleScanSheet}
            disabled={scanLoading}
            className="btn-primary text-xs whitespace-nowrap"
          >
            {scanLoading ? 'Scanning...' : scanResult ? 'Re-scan Sheet' : 'Scan Google Sheet'}
          </button>
        </div>
      </div>

      <div className="notice-box">
        <span>Discover creators per approved search term. Filter out dormant, autodubbed, and competitor-affiliated channels. Add creators to the campaign pipeline.</span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Left: Search terms */}
        <div className="card p-3 space-y-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Approved Terms ({approvedTerms.length})</p>
          {approvedTerms.length === 0 ? (
            <p className="text-xs text-gray-400">Generate and approve search terms first.</p>
          ) : (
            approvedTerms.map(term => (
              <button
                key={term.id}
                onClick={() => setSelectedTerm(selectedTerm === term.id ? null : term.id)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-100 transition-colors ${selectedTerm === term.id ? 'bg-accent-light text-accent font-medium' : 'text-gray-700'}`}
              >
                {term.term}
              </button>
            ))
          )}
        </div>

        {/* Center/Right: Creators table */}
        <div className="col-span-3 space-y-3">
          {/* Filters + Add URL */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={filterDormant} onChange={e => setFilterDormant(e.target.checked)} className="rounded" />
              <span className="text-gray-700">Exclude dormant</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={filterAutodub} onChange={e => setFilterAutodub(e.target.checked)} className="rounded" />
              <span className="text-gray-700">Exclude autodubbed</span>
            </label>
            <div className="flex-1" />
            <div className="flex gap-2">
              <input
                className="input-field w-64 text-xs"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                placeholder="Add creator by YouTube URLâ¦"
                onKeyDown={e => { if (e.key === 'Enter') handleAddCreatorUrl(); }}
              />
              <button onClick={handleAddCreatorUrl} disabled={addLoading} className="btn-secondary text-xs">
                {addLoading ? 'â¦' : 'Add'}
              </button>
            </div>
          </div>

          {/* Creators in pipeline */}
          {filteredCreators.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-3xl mb-2">ð¥</div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No creators in pipeline</h3>
              <p className="text-xs text-gray-500 mb-3">Add creator URLs to discover and shortlist creators.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">{filteredCreators.length} creators in pipeline</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-dense">
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Pipeline Stage</th>
                      <th>Topics</th>
                      <th>Last Content</th>
                      <th>Flags</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCreators.map(cc => (
                      <tr key={cc.id}>
                        <td>
                          <button
                            className="font-medium text-gray-900 hover:text-accent text-left"
                            onClick={() => { setSelectedCreator(cc); setDrawerOpen(true); }}
                          >
                            {cc.creator_name}
                          </button>
                          {cc.primary_handle && <div className="text-xs text-gray-400">{cc.primary_handle}</div>}
                        </td>
                        <td>
                          <span className={`badge text-xs ${pipelineStageColor(cc.pipeline_stage)}`}>
                            {stageLabel(cc.pipeline_stage)}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-0.5">
                            {(Array.isArray(cc.creator_topics) ? cc.creator_topics : []).slice(0, 2).map((tp: string) => (
                              <span key={tp} className="badge bg-gray-100 text-gray-600 border-gray-200 text-xs">{tp}</span>
                            ))}
                          </div>
                        </td>
                        <td className="text-xs text-gray-500">{formatDate(cc.last_content_date)}</td>
                        <td>
                          <div className="flex gap-1">
                            {cc.is_dormant && <FlagBadge flag="ghosted" />}
                            {cc.is_autodubbed_suspected && <span className="badge bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">autodub?</span>}
                            {cc.competitor_affiliated && <span className="badge bg-red-50 text-red-700 border-red-200 text-xs">competitor</span>}
                          </div>
                        </td>
                        <td>
                          <a href={`/creators/${cc.creator_id}`} className="btn-ghost text-xs px-2 py-1">Profile</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Creator quick view drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selectedCreator?.creator_name || 'Creator'}>
        {selectedCreator && (
          <div className="p-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{selectedCreator.creator_name}</h4>
              {selectedCreator.primary_handle && <p className="text-xs text-gray-500">{selectedCreator.primary_handle}</p>}
            </div>
            <dl className="text-xs space-y-2">
              <div className="flex justify-between">
                <dt className="text-gray-500">Last Content</dt>
                <dd className="text-gray-800">{formatDate(selectedCreator.last_content_date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Dormant</dt>
                <dd className={selectedCreator.is_dormant ? 'text-orange-600 font-medium' : 'text-gray-800'}>
                  {selectedCreator.is_dormant ? 'Yes (120+ days)' : 'No'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Autodub suspected</dt>
                <dd className={selectedCreator.is_autodubbed_suspected ? 'text-yellow-600 font-medium' : 'text-gray-800'}>
                  {selectedCreator.is_autodubbed_suspected ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Topics</p>
              <div className="flex flex-wrap gap-1">
                {(Array.isArray(selectedCreator.creator_topics) ? selectedCreator.creator_topics : []).map((tp: string) => (
                  <span key={tp} className="badge bg-gray-100 text-gray-700 border-gray-200 text-xs">{tp}</span>
                ))}
              </div>
            </div>
            <a href={`/creators/${selectedCreator.creator_id}`} className="btn-secondary w-full text-center block">
              View Full Profile â
            </a>
          </div>
        )}
      </Drawer>
    </div>
  );
}
