'use client';

import { useRole } from '@/components/layout/Shell';
import Link from 'next/link';

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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">System overview, integrations, and configuration.</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600 w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-sm mb-2">{stats.total_campaigns}</div>
          <div className="text-xs text-gray-600 font-medium">Total Campaigns</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-sm mb-2">{stats.active_campaigns}</div>
          <div className="text-xs text-gray-600 font-medium">Active Campaigns</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-600 w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-sm mb-2">{stats.creators_analyzed}</div>
          <div className="text-xs text-gray-600 font-medium">Creators Scored</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-teal-600 w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-sm mb-2">{stats.booking_rate}%</div>
          <div className="text-xs text-gray-600 font-medium">Booking Rate (7d)</div>
        </div>
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
