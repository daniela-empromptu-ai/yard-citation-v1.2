'use client';

import { useRole } from '@/components/layout/Shell';
import Link from 'next/link';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag } from '@/components/ui/Badge';
import { formatDate, outreachStateColor, stageLabel } from '@/lib/utils';

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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Outreach Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Copy drafts, track outreach states, log replies.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-sm mb-2">{stats.emails_to_send}</div>
          <div className="text-xs text-gray-600 font-medium">Emails to Send</div>
        </div>
        <div className="card p-4">
          <div className={`text-2xl font-bold w-10 h-10 rounded-lg flex items-center justify-center text-sm mb-2 ${stats.followups_due > 0 ? 'text-orange-600 bg-orange-50' : 'text-gray-400 bg-gray-100'}`}>{stats.followups_due}</div>
          <div className="text-xs text-gray-600 font-medium">Follow-ups Due</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-600 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-sm mb-2">0</div>
          <div className="text-xs text-gray-600 font-medium">Replies to Log</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-sm mb-2">{stats.booking_rate}%</div>
          <div className="text-xs text-gray-600 font-medium">Booking Rate (7d)</div>
        </div>
      </div>

      {/* Outreach Queue */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Outreach Queue</h2>
          <Link href="/outreach" className="text-xs text-accent hover:underline">View all â</Link>
        </div>
        {outreachQueue.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No creators in outreach queue.</p>
            <p className="text-xs mt-1">Creators must be approved by a Qualifier first.</p>
          </div>
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
                      <span className={`badge text-xs ${outreachStateColor(row.outreach_state)}`}>
                        {stageLabel(row.outreach_state)}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(row.next_followup_due_at)}</td>
                    <td className="text-xs text-gray-500">{row.owner_name || 'â'}</td>
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
        This tool does not send emails. All outreach is manual â copy the draft and send through your own email client.
      </div>
    </div>
  );
}
