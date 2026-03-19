import { format, parseISO } from 'date-fns'

export function getScoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-400', bg: 'bg-green-900/30', bar: 'bg-green-500', border: 'border-green-700/50' }
  if (score >= 65) return { text: 'text-amber-400', bg: 'bg-amber-900/30', bar: 'bg-amber-500', border: 'border-amber-700/50' }
  return { text: 'text-red-400', bg: 'bg-red-900/30', bar: 'bg-red-500', border: 'border-red-700/50' }
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'MMM d, yyyy')
  } catch {
    return date
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(parseISO(date), 'MMM d, yyyy HH:mm')
  } catch {
    return date
  }
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

export function outreachStateColor(state: string): string {
  switch (state) {
    case 'drafted':  return 'bg-blue-900/30 text-blue-400 border-blue-700/50'
    case 'copied':   return 'bg-indigo-900/30 text-indigo-400 border-indigo-700/50'
    case 'sent':     return 'bg-violet-900/30 text-violet-400 border-violet-700/50'
    case 'replied':  return 'bg-green-900/30 text-green-400 border-green-700/50'
    case 'ghosted':  return 'bg-red-900/30 text-red-400 border-red-700/50'
    case 'booked':   return 'bg-emerald-900/30 text-emerald-400 border-emerald-700/50'
    default:         return 'bg-slate-800/50 text-slate-400 border-slate-600/50'
  }
}

export function pipelineStageColor(stage: string): string {
  switch (stage) {
    case 'discovered':           return 'bg-slate-800/50 text-slate-400 border-slate-600/50'
    case 'queued_for_ingestion': return 'bg-blue-900/30 text-blue-400 border-blue-700/50'
    case 'ingested':             return 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
    case 'scored':               return 'bg-purple-900/30 text-purple-400 border-purple-700/50'
    case 'needs_manual_review':  return 'bg-amber-900/30 text-amber-400 border-amber-700/50'
    case 'approved':             return 'bg-teal-900/30 text-teal-400 border-teal-700/50'
    case 'outreach_ready':       return 'bg-green-900/30 text-green-400 border-green-700/50'
    case 'contacted':            return 'bg-violet-900/30 text-violet-400 border-violet-700/50'
    case 'booked':               return 'bg-emerald-900/30 text-emerald-400 border-emerald-700/50'
    case 'rejected':             return 'bg-red-900/30 text-red-400 border-red-700/50'
    case 'excluded':             return 'bg-gray-800/50 text-gray-500 border-gray-600/50'
    default:                     return 'bg-slate-800/50 text-slate-400 border-slate-600/50'
  }
}

export function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    discovered:           'Discovered',
    queued_for_ingestion: 'Queued',
    ingested:             'Ingested',
    scored:               'Scored',
    needs_manual_review:  'Needs Review',
    approved:             'Approved',
    outreach_ready:       'Outreach Ready',
    contacted:            'Contacted',
    booked:               'Booked',
    rejected:             'Rejected',
    excluded:             'Excluded',
    not_started:          'Not Started',
    drafted:              'Drafted',
    copied:               'Copied',
    sent:                 'Sent',
    replied:              'Replied',
    ghosted:              'Ghosted',
    draft:                'Draft',
    setup:                'Setup',
    active:               'Active',
    archived:             'Archived',
    terms:                'Terms',
    discovery:            'Discovery',
    ingestion:            'Ingestion',
    scoring:              'Scoring',
    review:               'Review',
    outreach:             'Outreach',
    tracking:             'Tracking',
    complete:             'Complete',
  }
  return labels[stage] ?? stage
}

export function categoryTagColor(tag: string): string {
  switch (tag) {
    case 'product_category':     return 'bg-blue-900/30 text-blue-400 border-blue-700/50'
    case 'competitor':           return 'bg-red-900/30 text-red-400 border-red-700/50'
    case 'implementation':       return 'bg-green-900/30 text-green-400 border-green-700/50'
    case 'problem_solution':     return 'bg-amber-900/30 text-amber-400 border-amber-700/50'
    case 'integration':          return 'bg-purple-900/30 text-purple-400 border-purple-700/50'
    case 'programming_language': return 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
    case 'tutorial_format':      return 'bg-teal-900/30 text-teal-400 border-teal-700/50'
    default:                     return 'bg-slate-800/50 text-slate-400 border-slate-600/50'
  }
}
