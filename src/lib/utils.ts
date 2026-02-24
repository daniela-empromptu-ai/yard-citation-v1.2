import { format, parseISO } from 'date-fns'

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
    case 'drafted':  return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'copied':   return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'sent':     return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'replied':  return 'bg-green-50 text-green-700 border-green-200'
    case 'ghosted':  return 'bg-red-50 text-red-700 border-red-200'
    case 'booked':   return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    default:         return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}

export function pipelineStageColor(stage: string): string {
  switch (stage) {
    case 'discovered':           return 'bg-slate-50 text-slate-600 border-slate-200'
    case 'queued_for_ingestion': return 'bg-blue-50 text-blue-600 border-blue-200'
    case 'ingested':             return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'scored':               return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'needs_manual_review':  return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'approved':             return 'bg-teal-50 text-teal-700 border-teal-200'
    case 'outreach_ready':       return 'bg-green-50 text-green-700 border-green-200'
    case 'contacted':            return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'booked':               return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'rejected':             return 'bg-red-50 text-red-700 border-red-200'
    case 'excluded':             return 'bg-gray-50 text-gray-500 border-gray-200'
    default:                     return 'bg-slate-50 text-slate-600 border-slate-200'
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
    case 'product_category':     return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'competitor':           return 'bg-red-50 text-red-700 border-red-200'
    case 'implementation':       return 'bg-green-50 text-green-700 border-green-200'
    case 'problem_solution':     return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'integration':          return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'programming_language': return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'tutorial_format':      return 'bg-teal-50 text-teal-700 border-teal-200'
    default:                     return 'bg-slate-50 text-slate-600 border-slate-200'
  }
}
