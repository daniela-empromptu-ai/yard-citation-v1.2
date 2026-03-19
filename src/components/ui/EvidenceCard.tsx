import { ExternalLink, Clock } from 'lucide-react'

interface EvidenceCardProps {
  quote: string;
  url: string;
  title?: string;
  platform?: string;
  published_at?: string | null;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  whyItMatters?: string;
  why_it_matters?: string;
  dimension?: string;
  featured?: boolean;
}

function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DIMENSION_COLORS: Record<string, string> = {
  technical_relevance: 'border-blue-500/50 bg-blue-900/20',
  audience_alignment: 'border-purple-500/50 bg-purple-900/20',
  content_quality: 'border-green-500/50 bg-green-900/20',
  channel_performance: 'border-amber-500/50 bg-amber-900/20',
  brand_fit: 'border-pink-500/50 bg-pink-900/20',
  general: 'border-slate-500/50 bg-slate-800/30',
}

const DIMENSION_BORDER_HEX: Record<string, string> = {
  technical_relevance: '#3b82f6',
  audience_alignment: '#a855f7',
  content_quality: '#22c55e',
  channel_performance: '#f59e0b',
  brand_fit: '#ec4899',
  general: '#64748b',
}

export function EvidenceCard({
  quote, url, title, platform,
  timestampStart, timestampEnd, timestamp_start, timestamp_end,
  whyItMatters, why_it_matters, dimension, featured
}: EvidenceCardProps) {
  const tsStart = timestampStart ?? timestamp_start
  const tsEnd = timestampEnd ?? timestamp_end
  const whyMatters = whyItMatters ?? why_it_matters

  if (featured) {
    const borderColor = dimension ? (DIMENSION_BORDER_HEX[dimension] || DIMENSION_BORDER_HEX.general) : DIMENSION_BORDER_HEX.general
    return (
      <div
        className="evidence-card-featured mb-3"
        style={{ borderLeftColor: borderColor, boxShadow: `0 0 20px ${borderColor}15` }}
      >
        <span className="quote-mark">&ldquo;</span>
        <blockquote className="text-sm text-slate-200 italic leading-relaxed mb-2 pl-4">
          {quote}
        </blockquote>

        {(tsStart !== null && tsStart !== undefined) && (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5 pl-4">
            <Clock size={11} />
            <a
              href={`${url}?t=${tsStart}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline font-medium"
            >
              [{formatTime(tsStart)}
              {tsEnd ? ` → ${formatTime(tsEnd)}` : ''}]
            </a>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1.5 truncate pl-4">
          <ExternalLink size={10} />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-400 hover:underline truncate"
            title={url}
          >
            {title || url}
          </a>
          {platform && <span className="text-slate-600 shrink-0">· {platform}</span>}
        </div>

        {whyMatters && (
          <div className="mt-2 pt-2 border-t border-slate-700/50 pl-4">
            <p className="text-xs text-slate-300">
              <span className="font-semibold text-slate-400">Why it matters:</span> {whyMatters}
            </p>
          </div>
        )}

        {dimension && (
          <div className="mt-1.5 pl-4">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              {dimension.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Standard (non-featured) card — unchanged
  const colorClass = dimension ? (DIMENSION_COLORS[dimension] || DIMENSION_COLORS.general) : DIMENSION_COLORS.general

  return (
    <div className={`evidence-card rounded-lg border-l-4 p-3 ${colorClass} mb-2`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-slate-500 mt-0.5 shrink-0 text-xs">&ldquo;</span>
        <blockquote className="text-[13px] text-slate-300 italic leading-relaxed">
          {quote}&rdquo;
        </blockquote>
      </div>

      {(tsStart !== null && tsStart !== undefined) && (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-400 mb-1.5">
          <Clock size={11} />
          <a
            href={`${url}?t=${tsStart}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline font-medium"
          >
            [{formatTime(tsStart)}
            {tsEnd ? ` → ${formatTime(tsEnd)}` : ''}]
          </a>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1.5 truncate">
        <ExternalLink size={10} />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-400 hover:underline truncate"
          title={url}
        >
          {title || url}
        </a>
        {platform && <span className="text-slate-600 shrink-0">· {platform}</span>}
      </div>

      {whyMatters && (
        <p className="text-[11px] text-slate-400 mt-1.5 pt-1.5 border-t border-slate-700/50">
          <span className="font-semibold">Why it matters:</span> {whyMatters}
        </p>
      )}

      {dimension && (
        <div className="mt-1.5">
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
            {dimension.replace(/_/g, ' ')}
          </span>
        </div>
      )}
    </div>
  )
}

export default EvidenceCard
