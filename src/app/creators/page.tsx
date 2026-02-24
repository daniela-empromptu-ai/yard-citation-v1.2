import { dbQuery, t } from '@/lib/db';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { PlatformBadge, FlagBadge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function CreatorsPage() {
  const res = await dbQuery<{
    id: string; display_name: string; primary_handle: string | null; bio: string | null;
    topics: string[]; languages: string[]; geo_focus: string[];
    is_dormant: boolean; is_autodubbed_suspected: boolean; competitor_affiliated: boolean;
    last_content_date: string | null; created_at: string;
    platforms: string; flags: string; pricing: string;
  }>(`
    SELECT
      c.id, c.display_name, c.primary_handle, c.bio, c.topics, c.languages, c.geo_focus,
      c.is_dormant, c.is_autodubbed_suspected, c.competitor_affiliated,
      c.last_content_date, c.created_at,
      COALESCE(string_agg(DISTINCT cpa.platform, ',') FILTER (WHERE cpa.platform IS NOT NULL), '') as platforms,
      COALESCE(string_agg(DISTINCT csf.flag, ',') FILTER (WHERE csf.flag IS NOT NULL AND csf.is_active = true), '') as flags,
      COALESCE(string_agg(DISTINCT CONCAT(cp.price_type, ':', cp.price_amount_usd), ',') FILTER (WHERE cp.id IS NOT NULL), '') as pricing
    FROM ${t('creators')} c
    LEFT JOIN ${t('creator_platform_accounts')} cpa ON cpa.creator_id = c.id
    LEFT JOIN ${t('creator_status_flags')} csf ON csf.creator_id = c.id AND csf.is_active = true
    LEFT JOIN ${t('creator_pricing')} cp ON cp.creator_id = c.id
    GROUP BY c.id
    ORDER BY c.display_name
  `);

  const creators = res.data;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Creators Database</h1>
          <p className="text-sm text-gray-500 mt-0.5">{creators.length} creators across all campaigns</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        {creators.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">ð¥</div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No creators yet</h3>
            <p className="text-xs text-gray-500">Add creators through campaign discovery or manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platforms</th>
                  <th>Topics</th>
                  <th>Languages</th>
                  <th>Last Content</th>
                  <th>Flags</th>
                  <th>Pricing</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => {
                  const platforms = c.platforms ? c.platforms.split(',').filter(Boolean) : [];
                  const flags = c.flags ? c.flags.split(',').filter(Boolean) : [];
                  const pricingStr = c.pricing || '';
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/creators/${c.id}`} className="font-medium text-gray-900 hover:text-accent block">
                          {c.display_name}
                        </Link>
                        {c.primary_handle && <div className="text-xs text-gray-400">{c.primary_handle}</div>}
                        <div className="flex gap-1 mt-0.5">
                          {c.is_dormant && <span className="badge bg-gray-100 text-gray-500 border-gray-200 text-xs">dormant</span>}
                          {c.is_autodubbed_suspected && <span className="badge bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">autodub?</span>}
                          {c.competitor_affiliated && <span className="badge bg-red-50 text-red-700 border-red-200 text-xs">competitor</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-0.5">
                          {platforms.slice(0, 3).map(p => <PlatformBadge key={p} platform={p} />)}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-0.5 max-w-32">
                          {(Array.isArray(c.topics) ? c.topics : []).slice(0, 2).map((tp: string) => (
                            <span key={tp} className="badge bg-gray-100 text-gray-600 border-gray-200 text-xs truncate max-w-20">{tp}</span>
                          ))}
                        </div>
                      </td>
                      <td className="text-xs text-gray-600">
                        {(Array.isArray(c.languages) ? c.languages : []).join(', ')}
                      </td>
                      <td className={`text-xs ${c.is_dormant ? 'text-orange-600' : 'text-gray-600'}`}>
                        {formatDate(c.last_content_date)}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-0.5">
                          {flags.map((f: string) => <FlagBadge key={f} flag={f} />)}
                        </div>
                      </td>
                      <td className="text-xs text-gray-500">
                        {pricingStr ? pricingStr.split(',').map((p: string) => {
                          const [type, amount] = p.split(':');
                          return <div key={type}>{type}: ${Number(amount).toLocaleString()}</div>;
                        }) : 'â'}
                      </td>
                      <td>
                        <Link href={`/creators/${c.id}`} className="btn-secondary text-xs py-1 px-2">Profile</Link>
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
