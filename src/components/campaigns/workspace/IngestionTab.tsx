'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, pipelineStageColor, stageLabel } from '@/lib/utils';
import Modal from '@/components/ui/Modal';

interface CC {
  id: string; creator_id: string; creator_name: string; pipeline_stage: string;
  ingestion_status: string; ingestion_error: string | null; updated_at: string;
}

interface ContentItem {
  id: string; title: string; url: string; platform: string; content_type: string;
  word_count: number | null; published_at: string | null; metadata_json: Record<string, unknown>;
  raw_text: string;
}

interface Props {
  campaign: { id: string };
  campaignCreators: CC[];
  [key: string]: unknown;
}

export default function IngestionTab({ campaign, campaignCreators }: Props) {
  const [selectedCc, setSelectedCc] = useState<CC | null>(null);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [addUrlModal, setAddUrlModal] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const loadContent = async (cc: CC) => {
    setSelectedCc(cc);
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/creators/${cc.creator_id}/content`);
      const data = await res.json();
      setContentItems(data.items || []);
    } finally {
      setLoadingContent(false);
    }
  };

  const addContent = async () => {
    if (!selectedCc || !newUrl) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/content-items/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator_id: selectedCc.creator_id,
          campaign_id: campaign.id,
          url: newUrl,
          title: newTitle || newUrl,
          raw_text: pasteText,
          platform: newUrl.includes('youtube.com') ? 'youtube' : newUrl.includes('reddit.com') ? 'reddit' : 'blog',
          content_type: newUrl.includes('youtube.com') ? 'youtube_video' : 'blog_post',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Content added');
        setAddUrlModal(false);
        setNewUrl(''); setNewTitle(''); setPasteText('');
        await loadContent(selectedCc);
        router.refresh();
      } else {
        addToast('error', data.error || 'Failed to add content');
      }
    } finally {
      setAddLoading(false);
    }
  };

  const statusColor: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600',
    queued: 'bg-blue-100 text-blue-700',
    running: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="notice-box">
        <span>Ingest creator content for scoring. YouTube transcripts are primary; blogs, Reddit threads, and podcasts are supplementary.</span>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Creators list */}
        <div className="col-span-2 card overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Creators ({(campaignCreators as CC[]).length})</span>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(campaignCreators as CC[]).map(cc => (
                  <tr key={cc.id} className={selectedCc?.id === cc.id ? 'bg-accent-light' : ''}>
                    <td>
                      <button
                        className="font-medium text-gray-900 hover:text-accent text-left text-xs"
                        onClick={() => loadContent(cc)}
                      >
                        {cc.creator_name}
                      </button>
                    </td>
                    <td>
                      <span className={`badge text-xs ${statusColor[cc.ingestion_status] || 'bg-gray-100 text-gray-600'}`}>
                        {cc.ingestion_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-ghost text-xs px-1.5 py-0.5"
                        onClick={() => { setSelectedCc(cc); setAddUrlModal(true); }}
                      >
                        + Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Content items */}
        <div className="col-span-3 card overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              {selectedCc ? `Content: ${selectedCc.creator_name}` : 'Select a creator to view content'}
            </span>
            {selectedCc && (
              <button className="btn-primary text-xs py-1 px-2" onClick={() => setAddUrlModal(true)}>
                + Add URL / Paste
              </button>
            )}
          </div>

          {!selectedCc ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">Select a creator from the list to view their ingested content.</p>
            </div>
          ) : loadingContent ? (
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin text-2xl mb-2">â³</div>
              <p className="text-sm">Loading contentâ¦</p>
            </div>
          ) : contentItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">ð</div>
              <p className="text-sm text-gray-600 font-medium">No content ingested yet</p>
              <p className="text-xs text-gray-400 mb-3">Add YouTube, blog, or Reddit URLs to ingest content.</p>
              <button className="btn-primary text-xs" onClick={() => setAddUrlModal(true)}>+ Add Content</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {contentItems.map(ci => (
                <div key={ci.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`badge text-xs flex-shrink-0 mt-0.5 ${
                      ci.platform === 'youtube' ? 'bg-red-50 text-red-700 border-red-200' :
                      ci.platform === 'reddit' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>{ci.platform}</span>
                    <div className="flex-1 min-w-0">
                      <a href={ci.url} target="_blank" rel="noopener" className="text-sm font-medium text-gray-900 hover:text-accent block truncate">
                        {ci.title}
                      </a>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        {ci.word_count && <span>{ci.word_count.toLocaleString()} words</span>}
                        {ci.published_at && <span>{formatDateTime(ci.published_at)}</span>}
                        {Boolean(ci.metadata_json?.view_count) && <span>{Number(ci.metadata_json.view_count).toLocaleString()} views</span>}
                      </div>
                    </div>
                    <span className="badge bg-green-50 text-green-700 border-green-200 text-xs">â</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add content modal */}
      <Modal open={addUrlModal} onClose={() => setAddUrlModal(false)} title={`Add Content â ${selectedCc?.creator_name || ''}`} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
            <input className="input-field" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title (optional)</label>
            <input className="input-field" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Content title" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Paste Transcript / Article Text</label>
            <textarea
              className="input-field h-32 resize-none text-xs font-mono"
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste the transcript or article text here for AI analysisâ¦"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setAddUrlModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={addContent} disabled={addLoading || !newUrl}>
              {addLoading ? 'Addingâ¦' : 'Add Content'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
