'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { outreachStateColor, stageLabel, formatDate } from '@/lib/utils';
import Drawer from '@/components/ui/Drawer';
import ReactMarkdown from 'react-markdown';
import { useRole } from '@/components/layout/Shell';

interface CC {
  id: string; creator_id: string; creator_name: string; pipeline_stage: string;
  outreach_state: string; next_followup_due_at: string | null;
  overall_score: number | null; evidence_coverage: string | null; owner_name: string | null;
}

interface OutreachPacket {
  subject: string; body_md: string; followup_plan_json: { channel: string; day: number; action: string; done: boolean }[];
}

interface Props {
  campaign: { id: string };
  campaignCreators: CC[];
  [key: string]: unknown;
}

const STATES: { value: string; label: string }[] = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'drafted', label: 'Drafted' },
  { value: 'copied', label: 'Copied' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'ghosted', label: 'Ghosted' },
  { value: 'booked', label: 'Booked' },
];

export default function OutreachTab({ campaign, campaignCreators }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCc, setSelectedCc] = useState<CC | null>(null);
  const [packet, setPacket] = useState<OutreachPacket | null>(null);
  const [loadingPacket, setLoadingPacket] = useState(false);
  const [generatingPacket, setGeneratingPacket] = useState<string | null>(null);
  const [updatingState, setUpdatingState] = useState<string | null>(null);
  const [copied, setCopied] = useState<'subject' | 'body' | 'all' | null>(null);
  const router = useRouter();
  const { addToast } = useToast();
  const { userId } = useRole();

  const eligibleCreators = (campaignCreators as CC[]).filter(cc =>
    ['outreach_ready', 'contacted', 'booked', 'approved'].includes(cc.pipeline_stage) ||
    cc.outreach_state !== 'not_started'
  );

  const openPacket = async (cc: CC) => {
    setSelectedCc(cc);
    setDrawerOpen(true);
    setLoadingPacket(true);
    try {
      const res = await fetch(`/api/outreach-packets/${cc.id}`);
      const data = await res.json();
      setPacket(data.packet || null);
    } finally {
      setLoadingPacket(false);
    }
  };

  const generatePacket = async (cc: CC) => {
    setGeneratingPacket(cc.id);
    try {
      const res = await fetch('/api/ai/outreach-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_creator_id: cc.id, user_id: userId }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('success', 'Outreach packet generated');
        await openPacket(cc);
        router.refresh();
      } else {
        addToast('error', data.error || 'Generation failed');
      }
    } finally {
      setGeneratingPacket(null);
    }
  };

  const updateState = async (cc: CC, newState: string) => {
    setUpdatingState(cc.id);
    try {
      const res = await fetch('/api/outreach/update-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_creator_id: cc.id, state: newState, user_id: userId }),
      });
      if (res.ok) {
        addToast('success', `State updated to ${newState}`);
        router.refresh();
      }
    } finally {
      setUpdatingState(null);
    }
  };

  const copyText = (text: string, type: 'subject' | 'body' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    addToast('info', 'Copied to clipboard');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="notice-box">
        <span>â ï¸ This tool does not send emails. Copy drafts and send manually through your own email client. All state changes are logged for tracking.</span>
      </div>

      {eligibleCreators.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">âï¸</div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No creators in outreach</h3>
          <p className="text-xs text-gray-500">Approve creators in the Review tab first.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-dense">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Outreach State</th>
                  <th>Next Follow-up</th>
                  <th>Owner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eligibleCreators.map(cc => (
                  <tr key={cc.id}>
                    <td className="font-medium text-gray-900">{cc.creator_name}</td>
                    <td>
                      <span className={`badge text-xs ${outreachStateColor(cc.outreach_state)}`}>
                        {stageLabel(cc.outreach_state)}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(cc.next_followup_due_at)}</td>
                    <td className="text-xs text-gray-500">{cc.owner_name || 'â'}</td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openPacket(cc)} className="btn-secondary text-xs py-1 px-2">
                          Open Packet
                        </button>
                        <button
                          onClick={() => generatePacket(cc)}
                          disabled={generatingPacket === cc.id}
                          className="btn-primary text-xs py-1 px-2"
                        >
                          {generatingPacket === cc.id ? 'â¦' : 'â¨ Generate'}
                        </button>
                        <select
                          className="select-field text-xs py-0.5 px-1 w-28"
                          value={cc.outreach_state}
                          onChange={e => updateState(cc, e.target.value)}
                          disabled={updatingState === cc.id}
                        >
                          {STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outreach Packet Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Outreach: ${selectedCc?.creator_name || ''}`} width="w-[640px]">
        {loadingPacket ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <div className="animate-spin text-2xl">â³</div>
          </div>
        ) : !packet ? (
          <div className="p-4 text-center">
            <div className="text-3xl mb-2">âï¸</div>
            <p className="text-sm text-gray-600 font-medium mb-3">No outreach packet yet</p>
            <p className="text-xs text-gray-400 mb-4">Generate an AI-assisted outreach draft based on the creator evaluation and content angles.</p>
            <button
              onClick={() => selectedCc && generatePacket(selectedCc)}
              disabled={generatingPacket === selectedCc?.id}
              className="btn-primary"
            >
              {generatingPacket ? 'â¨ Generatingâ¦' : 'â¨ Generate Outreach Draft'}
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-center gap-2">
              <span className="text-amber-600 text-sm">â ï¸</span>
              <p className="text-xs text-amber-700 font-medium">This tool does not send emails. Copy the draft and send manually.</p>
            </div>

            {/* Subject */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Subject Line</label>
                <button
                  onClick={() => copyText(packet.subject, 'subject')}
                  className="btn-ghost text-xs py-0.5 px-2"
                >
                  {copied === 'subject' ? 'â Copied' : 'ð Copy'}
                </button>
              </div>
              <div className="bg-gray-50 rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200">
                {packet.subject}
              </div>
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Email Body</label>
                <div className="flex gap-1">
                  <button onClick={() => copyText(packet.body_md, 'body')} className="btn-ghost text-xs py-0.5 px-2">
                    {copied === 'body' ? 'â Copied' : 'ð Copy Body'}
                  </button>
                  <button
                    onClick={() => copyText(`Subject: ${packet.subject}\n\n${packet.body_md}`, 'all')}
                    className="btn-primary text-xs py-0.5 px-2"
                  >
                    {copied === 'all' ? 'â Copied!' : 'ð Copy Full Email'}
                  </button>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-md p-4 max-h-64 overflow-y-auto prose prose-sm max-w-none">
                <ReactMarkdown>{packet.body_md}</ReactMarkdown>
              </div>
            </div>

            {/* Follow-up checklist */}
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-2">Follow-up Checklist</h4>
              <div className="space-y-1">
                {(packet.followup_plan_json || []).map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    <input type="checkbox" checked={step.done} readOnly className="rounded" />
                    <span className={`badge ${
                      step.channel === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      step.channel === 'linkedin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>{step.channel}</span>
                    <span className="text-gray-500">Day {step.day}:</span>
                    <span className="text-gray-700">{step.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
