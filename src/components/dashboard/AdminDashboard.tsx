'use client';

import { useRole } from '@/components/layout/Shell';
import Link from 'next/link';
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
  outreachQueue: unknown[];
  recentBooked: unknown[];
}

export default function AdminDashboard({ data }: { data: DashData }) {
  const { role } = useRole();
  if (role !== 'admin') return null;

  const { stats } = data;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="System overview, integrations, and configuration." />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Campaigns" value={stats.total_campaigns} color="blue" />
        <StatCard label="Active Campaigns" value={stats.active_campaigns} color="green" />
        <StatCard label="Creators Scored" value={stats.creators_analyzed} color="purple" />
        <StatCard label="Booking Rate (7d)" value={`${stats.booking_rate}%`} color="teal" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link href="/campaigns" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Campaigns</div>
          <p className="text-xs text-gray-500">Manage all campaigns across clients</p>
        </Link>
        <Link href="/creators" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Creators DB</div>
          <p className="text-xs text-gray-500">Global creator database with flags and history</p>
        </Link>
        <Link href="/settings" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Settings</div>
          <p className="text-xs text-gray-500">Integrations, thresholds, seed/clear tools</p>
        </Link>
        <Link href="/metrics" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Metrics</div>
          <p className="text-xs text-gray-500">Ops performance analytics</p>
        </Link>
        <Link href="/outreach" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Outreach Queue</div>
          <p className="text-xs text-gray-500">Cross-campaign outreach tracking</p>
        </Link>
        <Link href="/reddit" className="card p-4 hover:border-accent/50 transition-colors group">
          <div className="text-sm font-semibold text-gray-900 group-hover:text-accent mb-1">Reddit Monitor</div>
          <p className="text-xs text-gray-500">Fetched Reddit threads across campaigns</p>
        </Link>
      </div>
    </div>
  );
}
