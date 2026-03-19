'use client';

import { useState } from 'react';
import { formatDateTime } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';

interface ActivityEntry {
  id: string; event_type: string; actor_name?: string | null; created_at: string;
  event_data_json: Record<string, unknown>; campaign_creator_id: string | null;
  creator_id: string | null;
}

interface Props {
  activityLog: ActivityEntry[];
  [key: string]: unknown;
}

const EVENT_ICONS: Record<string, string> = {
  campaign_created: '🎯',
  evaluation_completed: '🧮',
  review_decision: '👤',
  outreach_sent: '✉️',
  outreach_replied: '💬',
  outreach_booked: '🎉',
  outreach_state_changed: '🔄',
  ingestion_completed: '📥',
  default: '📝',
};

const EVENT_COLORS: Record<string, string> = {
  campaign_created: 'bg-blue-900/30 text-blue-400',
  evaluation_completed: 'bg-purple-900/30 text-purple-400',
  review_decision: 'bg-orange-900/30 text-orange-400',
  outreach_sent: 'bg-teal-900/30 text-teal-400',
  outreach_replied: 'bg-green-900/30 text-green-400',
  outreach_booked: 'bg-emerald-900/30 text-emerald-400',
  outreach_state_changed: 'bg-slate-800/50 text-slate-400',
  default: 'bg-slate-800/50 text-slate-400',
};

function EventDetail({ event_type, data }: { event_type: string; data: Record<string, unknown> }) {
  if (event_type === 'evaluation_completed') {
    return (
      <span className="text-xs text-slate-500">
        Score: <strong className="text-slate-300">{data.score as number}</strong> · Coverage: {data.coverage as string}
        {Boolean(data.needs_manual_review) && ' · ⚠ NMR'}
      </span>
    );
  }
  if (event_type === 'review_decision') {
    return (
      <span className="text-xs text-slate-500">
        Decision: <strong className="text-slate-300">{(data.decision as string)?.replace(/_/g, ' ')}</strong>
        {Boolean(data.notes_md) && ` · "${data.notes_md as string}"`}
      </span>
    );
  }
  if (event_type === 'outreach_state_changed') {
    return <span className="text-xs text-slate-500">State → <strong className="text-slate-300">{data.state as string}</strong></span>;
  }
  if (event_type === 'outreach_booked') {
    return (
      <span className="text-xs text-slate-500">
        Booked 🎉 {data.deal_value ? `$${data.deal_value}` : ''}
      </span>
    );
  }
  const entries = Object.entries(data).filter(([, v]) => typeof v === 'string' || typeof v === 'number');
  if (entries.length === 0) return null;
  return (
    <span className="text-xs text-slate-600">
      {entries.slice(0, 3).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}
    </span>
  );
}

const INITIAL_SHOW = 20;

export default function ActivityTab({ activityLog }: Props) {
  const [showAll, setShowAll] = useState(false);
  const entries = activityLog as ActivityEntry[];
  const visible = showAll ? entries : entries.slice(0, INITIAL_SHOW);
  const hasMore = entries.length > INITIAL_SHOW;

  if (entries.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon="\ud83d\udcc4"
          title="No activity yet"
          description="Campaign events will appear here as work progresses."
        />
      </div>
    );
  }

  return (
    <div className="card divide-y divide-[#2d3748]">
      <div className="px-4 py-3 flex items-center justify-between bg-[#111827]">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Campaign Activity</span>
        <span className="text-xs text-slate-500">{entries.length} events</span>
      </div>
      <div className="divide-y divide-[#1e293b]">
        {visible.map(entry => {
          const icon = EVENT_ICONS[entry.event_type] || EVENT_ICONS.default;
          const colorClass = EVENT_COLORS[entry.event_type] || EVENT_COLORS.default;
          return (
            <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#263044]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${colorClass}`}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200 capitalize">
                    {entry.event_type.replace(/_/g, ' ')}
                  </span>
                  {entry.actor_name && (
                    <span className="text-xs text-slate-500">by {entry.actor_name}</span>
                  )}
                </div>
                <EventDetail event_type={entry.event_type} data={entry.event_data_json || {}} />
              </div>
              <span className="text-xs text-slate-500 flex-shrink-0">{formatDateTime(entry.created_at)}</span>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div className="px-4 py-2 border-t border-[#2d3748] text-center">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-xs text-blue-400 hover:underline"
          >
            {showAll ? `Show less` : `Show all ${entries.length} events`}
          </button>
        </div>
      )}
    </div>
  );
}
