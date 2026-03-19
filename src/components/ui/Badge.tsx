import clsx from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'purple'

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-slate-800/50 text-slate-400 border-slate-600/50',
  success: 'bg-green-900/30 text-green-400 border-green-700/50',
  warning: 'bg-amber-900/30 text-amber-400 border-amber-700/50',
  danger: 'bg-red-900/30 text-red-400 border-red-700/50',
  info: 'bg-blue-900/30 text-blue-400 border-blue-700/50',
  muted: 'bg-slate-800/50 text-slate-500 border-slate-600/50',
  purple: 'bg-purple-900/30 text-purple-400 border-purple-700/50',
}

export function Badge({ children, variant = 'default', className, size = 'sm' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center border font-medium rounded-full',
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      VARIANTS[variant],
      className
    )}>
      {children}
    </span>
  )
}

// Stage badge
export function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, BadgeVariant> = {
    draft: 'muted', terms: 'info', discovery: 'info', ingestion: 'warning',
    scoring: 'warning', review: 'purple', outreach: 'success', tracking: 'success', complete: 'success'
  }
  return <Badge variant={map[stage] || 'default'}>{stage}</Badge>
}

// Pipeline stage badge
export function PipelineBadge({ stage }: { stage: string }) {
  const map: Record<string, BadgeVariant> = {
    discovered: 'muted', queued_for_ingestion: 'info', ingested: 'info',
    scored: 'warning', needs_manual_review: 'danger', approved: 'success',
    outreach_ready: 'success', contacted: 'purple', booked: 'success',
    rejected: 'danger', excluded: 'muted',
  }
  return <Badge variant={map[stage] || 'default'} className="uppercase tracking-wide">{stage.replace(/_/g, ' ')}</Badge>
}

// Outreach state badge
export function OutreachBadge({ state }: { state: string }) {
  const map: Record<string, BadgeVariant> = {
    not_started: 'muted', drafted: 'info', copied: 'info', sent: 'warning',
    replied: 'purple', ghosted: 'danger', booked: 'success',
  }
  return <Badge variant={map[state] || 'default'}>{state.replace(/_/g, ' ')}</Badge>
}

// Coverage badge
export function CoverageBadge({ coverage }: { coverage: string }) {
  const map: Record<string, BadgeVariant> = {
    strong: 'success', medium: 'warning', weak: 'danger', none: 'muted'
  }
  return <Badge variant={map[coverage] || 'default'}>{coverage}</Badge>
}

// Coverage tag (alias for CoverageBadge)
export function CoverageTag({ coverage }: { coverage: string }) {
  return <CoverageBadge coverage={coverage} />
}

// Flag badge
export function FlagBadge({ flag }: { flag: string }) {
  return <Badge variant="danger" size="sm">{flag.replace(/_/g, ' ')}</Badge>
}

// Ingestion status badge
export function IngestionStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    not_started: 'muted', queued: 'info', running: 'warning', complete: 'success', failed: 'danger',
  }
  return <Badge variant={map[status] || 'default'}>{status.replace(/_/g, ' ')}</Badge>
}

// Platform badge
export function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, BadgeVariant> = {
    youtube: 'danger', blog: 'muted', medium: 'muted', devto: 'info',
    reddit: 'warning', github: 'default', linkedin: 'info', podcast: 'purple',
    newsletter: 'purple', other: 'muted',
  }
  return <Badge variant={map[platform] || 'default'}>{platform}</Badge>
}
