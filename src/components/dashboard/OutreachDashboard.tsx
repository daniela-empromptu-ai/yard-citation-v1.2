'use client';

import { useRole } from '@/components/layout/Shell';
import Link from 'next/link';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag, OutreachBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCard } from '@/components/ui/StatCard';
import { PageHeader } from '@/components/ui/PageHeader';

interface DashData {
  stats: {
    total_campaigns: number; active_campaigns: number; creators_analyzed: number;
    approved_count: number; needs_manual_review: number; emails_to_send: number;
    followups_due: number; booking_rate: number;
  };
  nmrQueue: unknown[];
  scoringRuns: unknown[];
  outreachQueue: Array<{
    cc_id: string; creator_name: string; campaign_name: string; outreach_state: string;
    next_followup_due_at: string | null; owner_name: string | null;
    overall_score: number; evidence_coverage: string;
  }>;
  recentBooked: unknown[];
}

export default function OutreachDashboard({ data }: { data: DashData }) {
  const { role } = useRole();
  if (role !== 'outreach') return null;

  const { stats, outreachQueue } = data;

  return (
    <div>
      <PageHeader title="Outreach Dashboard" subtitle="Copy drafts, track outreach states, log replies." />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Emails to Send" value={stats.emails_to_send} color="blue" />
        <StatCard label="Follow-ups Due" value={stats.followups_due} color="orange" urgent />
        <StatCard label="Replies to Log" value={0} color="purple" />
        <StatCard label="Booking Rate (7d)" value={`${stats.booking_rate}%`} color="green" />
      </div>

      {/* Outreach Queue */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Outreach Queue</h2>
          <Link href="/outreach" className="text-xs text-accent hover:underline">View all →</Link>
        </div>
        {outreachQueue.length === 0 ? (
          <EmptyState title="No creators in outreach queue" description="Creators must be approved by a Qualifier first." compact />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Campaign</th>
                  <th>State</th>
                  <th>Next Follow-up</th>
                  <th>Owner</th>
                  <th>Score</th>
                  <th>Coverage</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {outreachQueue.map((row) => (
                  <tr key={row.cc_id}>
                    <td className="font-medium text-gray-900">{row.creator_name}</td>
                    <td className="text-gray-600 text-xs">{row.campaign_name}</td>
                    <td>
                      <OutreachBadge state={row.outreach_state} />
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(row.next_followup_due_at)}</td>
                    <td className="text-xs text-gray-500">{row.owner_name || '—'}</td>
                    <td><ScorePill score={row.overall_score} /></td>
                    <td><CoverageTag coverage={row.evidence_coverage || 'none'} /></td>
                    <td>
                      <Link href="/outreach" className="btn-primary text-xs py-1 px-2">Open Packet</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="notice-box">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        This tool does not send emails. All outreach is manual — copy the draft and send through your own email client.
      </div>
    </div>
  );
}
