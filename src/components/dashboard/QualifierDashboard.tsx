'use client';

import { useRole } from '@/components/layout/Shell';
import Link from 'next/link';
import ScorePill from '@/components/ui/ScorePill';
import { CoverageTag } from '@/components/ui/Badge';
import { formatDateTime, stageLabel } from '@/lib/utils';

interface DashData {
  stats: {
    total_campaigns: number; active_campaigns: number; creators_analyzed: number;
    approved_count: number; needs_manual_review: number; emails_to_send: number;
    followups_due: number; booking_rate: number;
  };
  nmrQueue: Array<{
    cc_id: string; creator_name: string; campaign_name: string;
    evidence_coverage: string; overall_score: number; needs_manual_review_reason: string; updated_at: string;
  }>;
  scoringRuns: Array<{
    cc_id: string; creator_name: string; campaign_name: string;
    overall_score: number; evidence_coverage: string; evaluated_at: string; needs_manual_review: boolean;
  }>;
  outreachQueue: unknown[];
  recentBooked: unknown[];
}

export default function QualifierDashboard({ data }: { data: DashData }) {
  const { role } = useRole();
  if (role !== 'qualifier') return null;

  const { stats, nmrQueue, scoringRuns } = data;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Qualifier Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review creators, validate evidence, approve for outreach.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Creators Analyzed" value={stats.creators_analyzed} color="blue" />
        <StatCard label="Needs Manual Review" value={stats.needs_manual_review} color="orange" urgent />
        <StatCard label="Approved for Outreach" value={stats.approved_count} color="green" />
        <StatCard label="Active Campaigns" value={stats.active_campaigns} color="purple" />
      </div>

      {/* NMR Queue */}
      <div className="card mb-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Needs Manual Review Queue</h2>
          <span className="text-xs text-gray-500">{nmrQueue.length} creators</span>
        </div>
        {nmrQueue.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No creators pending manual review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Campaign</th>
                  <th>Evidence</th>
                  <th>Score</th>
                  <th>Reason</th>
                  <th>Last Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {nmrQueue.map((row) => (
                  <tr key={row.cc_id}>
                    <td className="font-medium text-gray-900">{row.creator_name}</td>
                    <td className="text-gray-600">{row.campaign_name}</td>
                    <td><CoverageTag coverage={row.evidence_coverage || 'none'} /></td>
                    <td><ScorePill score={row.overall_score} /></td>
                    <td className="max-w-xs truncate text-gray-500 text-xs">{row.needs_manual_review_reason || 'â'}</td>
                    <td className="text-gray-400 text-xs">{formatDateTime(row.updated_at)}</td>
                    <td>
                      <Link href={`/campaigns?tab=review&cc=${row.cc_id}`} className="btn-primary text-xs py-1 px-2">
                        Open Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Scoring Runs */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Recent Scoring Runs</h2>
        </div>
        {scoringRuns.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-sm">No scoring runs yet. Run scoring on campaign creators.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Campaign</th>
                  <th>Score</th>
                  <th>Coverage</th>
                  <th>Scored At</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scoringRuns.map((row) => (
                  <tr key={row.cc_id}>
                    <td className="font-medium text-gray-900">{row.creator_name}</td>
                    <td className="text-gray-600">{row.campaign_name}</td>
                    <td><ScorePill score={row.overall_score} /></td>
                    <td><CoverageTag coverage={row.evidence_coverage || 'none'} /></td>
                    <td className="text-gray-400 text-xs">{formatDateTime(row.evaluated_at)}</td>
                    <td>
                      {row.needs_manual_review ? (
                        <span className="badge bg-orange-50 text-orange-700 border-orange-200 text-xs">NMR</span>
                      ) : (
                        <span className="badge bg-green-50 text-green-700 border-green-200 text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Evidence required for all scores and recommendations. Â· Assistive only â human approval required before outreach.
      </p>
    </div>
  );
}

function StatCard({ label, value, color, urgent }: {
  label: string; value: number; color: string; urgent?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    orange: 'text-orange-600 bg-orange-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <div className={`card p-4 ${urgent && value > 0 ? 'border-orange-200 bg-orange-50/30' : ''}`}>
      <div className={`text-2xl font-bold ${colorMap[color] || ''} w-10 h-10 rounded-lg flex items-center justify-center text-sm mb-2`}>
        {value}
      </div>
      <div className="text-xs text-gray-600 font-medium">{label}</div>
    </div>
  );
}
