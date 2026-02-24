import { dbQuery, t } from '@/lib/db';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RedditMonitorPage() {
  const res = await dbQuery<{
    id: string; title: string; url: string; published_at: string | null;
    fetched_at: string | null; metadata_json: Record<string, unknown>;
    campaign_name: string | null; campaign_id: string | null;
  }>(`
    SELECT ci.id, ci.title, ci.url, ci.published_at, ci.fetched_at, ci.metadata_json,
      camp.name as campaign_name, camp.id as campaign_id
    FROM ${t('content_items')} ci
    LEFT JOIN ${t('campaigns')} camp ON camp.id = ci.campaign_id
    WHERE ci.platform = 'reddit'
    ORDER BY ci.fetched_at DESC NULLS LAST
    LIMIT 100
  `);

  const threads = res.data;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reddit Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Fetched Reddit threads across all campaigns. Read-only.</p>
        </div>
      </div>

      <div className="notice-box mb-5">
        <span>Read-only monitoring dashboard. No posting, no commenting, no automation. Fetch threads from within each campaign's Reddit tab.</span>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">All Reddit Threads ({threads.length})</h2>
        </div>
        {threads.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">ð¡</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No Reddit threads fetched yet</h3>
            <p className="text-xs text-gray-500 mb-2">Use the Reddit tab within a campaign workspace to fetch threads.</p>
            <p className="text-xs text-gray-400">You can configure subreddits and keywords per campaign.</p>
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
                  <th>Posted</th>
                  <th>Fetched</th>
                  <th>Campaign</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {threads.map((t) => {
                  const meta = t.metadata_json || {};
                  return (
                    <tr key={t.id}>
                      <td className="font-medium text-gray-900 max-w-sm">
                        <a href={t.url} target="_blank" rel="noopener" className="hover:text-accent line-clamp-2">{t.title}</a>
                      </td>
                      <td>
                        <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">
                          r/{(meta as {subreddit?: string}).subreddit || 'â'}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{(meta as {karma?: number}).karma || 0}</td>
                      <td className="font-mono text-sm">{(meta as {comment_count?: number}).comment_count || 0}</td>
                      <td className="text-xs text-gray-400">{formatDateTime(t.published_at)}</td>
                      <td className="text-xs text-gray-400">{formatDateTime(t.fetched_at)}</td>
                      <td className="text-xs">
                        {t.campaign_name ? (
                          <a href={`/campaigns/${t.campaign_id}`} className="text-accent hover:underline">{t.campaign_name}</a>
                        ) : 'â'}
                      </td>
                      <td>
                        <a href={t.url} target="_blank" rel="noopener" className="btn-ghost text-xs py-1 px-2">â View</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
