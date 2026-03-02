import { dbQuery, t } from '@/lib/db';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag, OutreachBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function OutreachQueuePage() {
  const res = await dbQuery<{
    cc_id: string; creator_name: string; campaign_name: string; campaign_id: string;
    overall_score: number | null; evidence_coverage: string | null; outreach_state: string;
    next_followup_due_at: string | null; owner_name: string | null; pipeline_stage: string;
  }>(`
    SELECT
      cc.id as cc_id, c.display_name as creator_name,
      camp.name as campaign_name, camp.id as campaign_id,
      e.overall_score, e.evidence_coverage, cc.outreach_state,
      cc.next_followup_due_at, u.name as owner_name, cc.pipeline_stage
    FROM ${t('campaign_creators')} cc
    JOIN ${t('creators')} c ON c.id = cc.creator_id
    JOIN ${t('campaigns')} camp ON camp.id = cc.campaign_id
    LEFT JOIN ${t('creator_evaluations')} e ON e.campaign_creator_id = cc.id
    LEFT JOIN ${t('app_users')} u ON u.id = cc.outreach_owner_user_id
    WHERE cc.pipeline_stage IN ('outreach_ready', 'contacted', 'booked', 'approved')
       OR cc.outreach_state NOT IN ('not_started')
    ORDER BY cc.next_followup_due_at ASC NULLS LAST, cc.updated_at DESC
  `);

  const queue = res.data;
  const today = new Date().toISOString().split('T')[0];
  const dueToday = queue.filter(r => r.next_followup_due_at && r.next_followup_due_at <= today);

  return (
    <div className="p-6">
      <PageHeader title="Outreach Queue" subtitle="Cross-campaign outreach tracking" />

      <div className="notice-box mb-5">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        This tool does not send emails. Copy drafts and send manually. All state changes are tracked here for reporting.
      </div>

      {dueToday.length > 0 && (
        <div className="card mb-5 border-orange-200">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
            <h2 className="text-sm font-semibold text-orange-800">⏰ Follow-ups Due Today ({dueToday.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr><th>Creator</th><th>Campaign</th><th>State</th><th>Follow-up Due</th><th>Owner</th><th></th></tr>
              </thead>
              <tbody>
                {dueToday.map(r => (
                  <tr key={r.cc_id} className="bg-orange-50/30">
                    <td className="font-medium text-gray-900">{r.creator_name}</td>
                    <td className="text-xs text-gray-600"><Link href={`/campaigns/${r.campaign_id}`} className="hover:text-accent">{r.campaign_name}</Link></td>
                    <td><OutreachBadge state={r.outreach_state} /></td>
                    <td className="text-orange-700 font-medium text-xs">{formatDate(r.next_followup_due_at)}</td>
                    <td className="text-xs text-gray-500">{r.owner_name || '—'}</td>
                    <td><Link href={`/campaigns/${r.campaign_id}?tab=outreach`} className="btn-primary text-xs py-1 px-2">Open Packet</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">All Outreach ({queue.length})</h2>
        </div>
        {queue.length === 0 ? (
          <EmptyState
            icon="\u2709\ufe0f"
            title="No outreach in progress"
            description="Creators approved in campaigns will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Campaign</th>
                  <th>Score</th>
                  <th>Coverage</th>
                  <th>State</th>
                  <th>Next Follow-up</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(r => (
                  <tr key={r.cc_id}>
                    <td className="font-medium text-gray-900">{r.creator_name}</td>
                    <td className="text-xs">
                      <Link href={`/campaigns/${r.campaign_id}`} className="text-gray-600 hover:text-accent">{r.campaign_name}</Link>
                    </td>
                    <td><ScorePill score={r.overall_score} /></td>
                    <td><CoverageTag coverage={r.evidence_coverage || 'none'} /></td>
                    <td><OutreachBadge state={r.outreach_state} /></td>
                    <td className="text-xs text-gray-500">{formatDate(r.next_followup_due_at)}</td>
                    <td className="text-xs text-gray-500">{r.owner_name || '—'}</td>
                    <td>
                      <Link href={`/campaigns/${r.campaign_id}?tab=outreach`} className="btn-secondary text-xs py-1 px-2">
                        Open Packet
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
