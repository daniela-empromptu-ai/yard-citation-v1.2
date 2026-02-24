import { ExternalLink, Clock, Quote } from 'lucide-react'

interface EvidenceCardProps {
  quote: string;
  url: string;
  title?: string;
  timestampStart?: number | null;
  timestampEnd?: number | null;
  whyItMatters?: string;
  dimension?: string;
}

function formatTime(seconds: number | null | undefined): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const DIMENSION_COLORS: Record<string, string> = {
  technical_relevance: 'border-blue-400 bg-blue-50',
  audience_alignment: 'border-purple-400 bg-purple-50',
  content_quality: 'border-green-400 bg-green-50',
  channel_performance: 'border-amber-400 bg-amber-50',
  brand_fit: 'border-pink-400 bg-pink-50',
  general: 'border-slate-400 bg-slate-50',
}

export function EvidenceCard({
  quote, url, title, timestampStart, timestampEnd, whyItMatters, dimension
}: EvidenceCardProps) {
  const colorClass = dimension ? (DIMENSION_COLORS[dimension] || DIMENSION_COLORS.general) : DIMENSION_COLORS.general

  return (
    <div className={`evidence-card rounded-lg border-l-4 p-3 ${colorClass} mb-2`}>
      {/* Quote */}
      <div className="flex items-start gap-2 mb-2">
        <Quote size={12} className="text-slate-400 mt-0.5 shrink-0" />
        <blockquote className="text-[13px] text-slate-700 italic leading-relaxed">
          &ldquo;{quote}&rdquo;
        </blockquote>
      </div>

      {/* Timestamp */}
      {(timestampStart !== null && timestampStart !== undefined) && (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-600 mb-1.5">
          <Clock size={11} />
          <a
            href={`${url}?t=${timestampStart}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline font-medium"
          >
            [{formatTime(timestampStart)}
            {timestampEnd ? ` â ${formatTime(timestampEnd)}` : ''}]
          </a>
        </div>
      )}

      {/* Source URL */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1.5 truncate">
        <ExternalLink size={10} />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-blue-600 hover:underline truncate"
          title={url}
        >
          {title || url}
        </a>
      </div>

      {/* Why it matters */}
      {whyItMatters && (
        <p className="text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-200">
          <span className="font-semibold">Why it matters:</span> {whyItMatters}
        </p>
      )}

      {/* Dimension pill */}
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
