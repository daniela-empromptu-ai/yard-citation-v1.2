import clsx from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'purple'

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

const VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  muted: 'bg-slate-50 text-slate-500 border-slate-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
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

// Platform badge
export function PlatformBadge({ platform }: { platform: string }) {
  const map: Record<string, BadgeVariant> = {
    youtube: 'danger', blog: 'muted', medium: 'muted', devto: 'info',
    reddit: 'warning', github: 'default', linkedin: 'info', podcast: 'purple',
    newsletter: 'purple', other: 'muted',
  }
  return <Badge variant={map[platform] || 'default'}>{platform}</Badge>
}
