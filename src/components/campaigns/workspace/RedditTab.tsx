'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/utils';

interface Props {
  campaign: { id: string };
  [key: string]: unknown;
}

interface RedditThread {
  id: string; title: string; url: string; published_at: string | null;
  metadata_json: { subreddit: string; karma: number; comment_count: number };
}

export default function RedditTab({ campaign }: Props) {
  const [subreddits, setSubreddits] = useState('kubernetes,devops,sre');
  const [keywords, setKeywords] = useState('kubernetes cost,finops,kubecost');
  const [fetching, setFetching] = useState(false);
  const [threads, setThreads] = useState<RedditThread[]>([]);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();

  const fetchThreads = async () => {
    setFetching(true);
    try {
      const subList = subreddits.split(',').map(s => s.trim().replace(/^r\//, ''));
      const kwList = keywords.split(',').map(k => k.trim());

      const res = await fetch('/api/reddit/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaign.id, subreddits: subList, keywords: kwList }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', `Fetched ${data.inserted} new threads (${data.skipped} duplicates skipped)`);
        // Reload threads
        loadThreads();
        router.refresh();
      } else {
        addToast('error', data.error || 'Fetch failed');
      }
    } finally {
      setFetching(false);
    }
  };

  const loadThreads = async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}/reddit-threads`);
    const data = await res.json();
    setThreads(data.threads || []);
    setLoaded(true);
  };

  return (
    <div className="space-y-4">
      {/* Config */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Reddit Monitoring Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Subreddits to watch</label>
            <input className="input-field text-xs" value={subreddits} onChange={e => setSubreddits(e.target.value)} placeholder="kubernetes, devops, sre" />
            <p className="text-xs text-gray-400 mt-0.5">Comma-separated, e.g. kubernetes, devops</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Keywords to match</label>
            <input className="input-field text-xs" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="kubernetes cost, finops, kubecost" />
            <p className="text-xs text-gray-400 mt-0.5">Comma-separated keywords</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={fetchThreads} disabled={fetching} className="btn-primary text-xs">
            {fetching ? 'â³ Fetchingâ¦' : 'ð Fetch Reddit Threads'}
          </button>
          {!loaded && (
            <button onClick={loadThreads} className="btn-secondary text-xs">Load Existing Threads</button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">Read-only monitoring. No posting or commenting.</p>
      </div>

      {/* Threads */}
      {loaded && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <span className="text-xs font-semibold text-gray-700">Reddit Threads â Campaign {campaign.id.slice(0, 8)}</span>
          </div>
          {threads.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No Reddit threads fetched yet for this campaign.</p>
              <p className="text-xs mt-1">Click "Fetch Reddit Threads" to pull matching posts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-dense">
                <thead>
                  <tr>
                    <th>Thread Title</th>
                    <th>Subreddit</th>
                    <th>Karma</th>
                    <th>Comments</th>
                    <th>Fetched</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {threads.map(t => (
                    <tr key={t.id}>
                      <td className="font-medium text-gray-900 max-w-md">
                        <a href={t.url} target="_blank" rel="noopener" className="hover:text-accent">{t.title}</a>
                      </td>
                      <td>
                        <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">r/{t.metadata_json?.subreddit}</span>
                      </td>
                      <td className="font-mono text-sm">{t.metadata_json?.karma || 0}</td>
                      <td className="font-mono text-sm">{t.metadata_json?.comment_count || 0}</td>
                      <td className="text-xs text-gray-400">{formatDateTime(t.published_at)}</td>
                      <td>
                        <a href={t.url} target="_blank" rel="noopener" className="btn-ghost text-xs py-1 px-2">â</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
