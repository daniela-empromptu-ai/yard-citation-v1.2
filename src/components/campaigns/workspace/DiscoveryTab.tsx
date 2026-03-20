'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, ArrowRight, Search, Newspaper, FlaskConical, Sparkles, Trophy } from 'lucide-react';

interface PipelineJob {
  id: string; status: string; error_message: string | null;
  started_at: string | null; finished_at: string | null;
}

interface PipelineEvent {
  level: string; message: string; created_at: string;
}

interface Props {
  campaign: { id: string; client_name: string };
  pipelineJob?: PipelineJob | null;
  onComplete?: () => void;
  [key: string]: unknown;
}

const DISCOVERY_STEPS = [
  { icon: Search,        label: 'Searching YouTube',       detail: 'Discovering relevant creators and channels across YouTube...', color: '#ef4444' },
  { icon: Newspaper,     label: 'Scanning Medium & Dev.to', detail: 'Finding expert voices, technical writers, and thought leaders...', color: '#22c55e' },
  { icon: FlaskConical,  label: 'Pre-qualifying Creators', detail: 'Fetching content, pulling transcripts, checking topic relevancy...', color: '#3b82f6' },
  { icon: Sparkles,      label: 'Evaluating Quality',      detail: 'Analyzing creator quality, audience fit, and brand alignment...', color: '#f59e0b' },
  { icon: Trophy,        label: 'Scoring & Ranking',       detail: 'Building your curated list of best creator matches...', color: '#a855f7' },
];

function stageToStep(stage: string): number {
  switch (stage) {
    case 'discovery': return 1;
    case 'ingestion': return 2;
    case 'scoring': return 4;
    default: return 0;
  }
}

export default function DiscoveryTab({ campaign, pipelineJob: initialJob, onComplete }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<PipelineJob | null>(initialJob || null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [pipelineStage, setPipelineStage] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isRunning = job?.status === 'queued' || job?.status === 'running';
  const isCompleted = job?.status === 'completed';
  const isFailed = job?.status === 'failed';
  const activeStep = isCompleted ? DISCOVERY_STEPS.length : stageToStep(pipelineStage);

  // Poll pipeline status
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/pipeline-status`);
      const data = await res.json();
      if (data.stage) setPipelineStage(data.stage);
      if (data.job) setJob(data.job);
      if (data.events) setEvents(data.events);
    } catch { /* ignore */ }
  }, [campaign.id]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [poll]);

  // Elapsed timer
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      if (job?.started_at) {
        setElapsed(Math.floor((Date.now() - new Date(job.started_at).getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, job?.started_at]);


  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">
          {isCompleted
            ? `Engagement leads ready for ${campaign.client_name}`
            : `Discovering engagement leads for ${campaign.client_name}`
          }
        </h2>
        <p className="text-sm text-slate-400">
          {isCompleted
            ? 'Your curated creator list is ready to review.'
            : 'We\'re searching across platforms to find the best creators for your campaign.'
          }
        </p>
        {isRunning && elapsed > 0 && (
          <p className="text-xs text-slate-500 mt-2">Elapsed: {formatElapsed(elapsed)} — typically takes 5-10 minutes</p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {DISCOVERY_STEPS.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep && isRunning;
          const isPending = i > activeStep && !isCompleted;

          return (
            <div
              key={i}
              className={`rounded-xl border p-4 transition-all duration-500 ${
                isDone || isCompleted
                  ? 'bg-[#1e293b] border-green-800/40'
                  : isActive
                  ? 'bg-[#1e293b] border-blue-700/50 shadow-lg shadow-blue-900/20'
                  : 'bg-[#1e293b]/40 border-[#2d3748]/50 opacity-50'
              }`}
              style={{
                borderLeftWidth: '3px',
                borderLeftColor: isDone || isCompleted ? '#22c55e' : isActive ? step.color : '#2d3748',
              }}
            >
              <div className="flex items-center gap-4">
                <step.icon size={22} style={{ color: isDone || isCompleted ? '#22c55e' : isActive ? step.color : '#475569' }} className="shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isDone || isCompleted ? 'text-green-400' : isActive ? 'text-slate-100' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                    {isDone || isCompleted ? (
                      <CheckCircle2 size={14} className="text-green-400" />
                    ) : isActive ? (
                      <Loader2 size={14} className="text-blue-400 animate-spin" />
                    ) : null}
                  </div>
                  <p className={`text-xs mt-0.5 ${isDone || isCompleted ? 'text-slate-500' : isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                    {step.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completed CTA */}
      {isCompleted && (
        <div className="text-center pt-4">
          <button
            onClick={() => onComplete?.()}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-900/30"
          >
            View Your Curated Creators <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-center">
          <p className="text-sm font-medium text-red-400 mb-1">Something went wrong</p>
          <p className="text-xs text-red-300">{job?.error_message || 'The engagement generation encountered an error.'}</p>
        </div>
      )}

      {/* Waiting message */}
      {isRunning && (
        <div className="text-center py-4">
          <p className="text-sm text-slate-400">You can leave this page and come back — we'll keep working in the background.</p>
        </div>
      )}

      {/* Technical logs (collapsible) */}
      {events.length > 0 && (
        <div className="border border-[#2d3748] rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-500 hover:bg-[#263044] transition-colors"
          >
            <span>Technical Details ({events.length} events)</span>
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showLogs && (
            <div className="max-h-48 overflow-y-auto bg-[#111827] p-3 border-t border-[#2d3748]">
              {events.map((ev, i) => (
                <div key={i} className={`text-[11px] flex gap-2 py-0.5 font-mono ${
                  ev.level === 'error' ? 'text-red-400' :
                  ev.level === 'warn' ? 'text-amber-400' :
                  'text-slate-500'
                }`}>
                  <span className="text-slate-700 shrink-0">
                    {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span>{ev.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
