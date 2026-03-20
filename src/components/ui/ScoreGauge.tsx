'use client'

import { getScoreColor } from '@/lib/utils'

const DIMENSION_COLORS: Record<string, string> = {
  technical_relevance: '#3b82f6',
  audience_alignment: '#a855f7',
  content_quality: '#22c55e',
  channel_performance: '#f59e0b',
  brand_fit: '#ec4899',
}

const SCORE_TIER_HEX: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
}

function getScoreHex(score: number): string {
  if (score >= 80) return SCORE_TIER_HEX.green
  if (score >= 65) return SCORE_TIER_HEX.amber
  return SCORE_TIER_HEX.red
}

interface ScoreGaugeProps {
  score: number | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  label?: string
  weight?: number
  color?: string
  showLabel?: boolean
}

const SIZE_CONFIG = {
  sm: { px: 40, stroke: 3, fontSize: 13, subSize: 0, radius: 16 },
  md: { px: 80, stroke: 4, fontSize: 22, subSize: 10, radius: 34 },
  lg: { px: 120, stroke: 6, fontSize: 34, subSize: 12, radius: 52 },
  xl: { px: 180, stroke: 8, fontSize: 52, subSize: 16, radius: 78 },
}

export function ScoreGauge({ score: scoreProp, size = 'sm', label, weight, color, showLabel = true }: ScoreGaugeProps & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const score = scoreProp ?? 0
  const cfg = SIZE_CONFIG[size]
  const center = cfg.px / 2
  const circumference = 2 * Math.PI * cfg.radius
  const pct = Math.min(Math.max(score, 0), 100) / 100
  const offset = circumference * (1 - pct)
  const strokeColor = color || getScoreHex(score)

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg
        className="score-ring"
        width={cfg.px}
        height={cfg.px}
        viewBox={`0 0 ${cfg.px} ${cfg.px}`}
      >
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={cfg.radius}
          fill="none"
          stroke="#2d3748"
          strokeWidth={cfg.stroke}
        />
        {/* Fill arc */}
        <circle
          className="gauge-fill"
          cx={center}
          cy={center}
          r={cfg.radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={cfg.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Score text */}
        <text
          x={center}
          y={size === 'lg' || size === 'xl' ? center - 6 : center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e2e8f0"
          fontSize={cfg.fontSize}
          fontWeight="700"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {score}
        </text>
        {/* "/ 100" sub text for lg/xl */}
        {(size === 'lg' || size === 'xl') && (
          <text
            x={center}
            y={center + (size === 'xl' ? 26 : 18)}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#64748b"
            fontSize={cfg.subSize}
            fontFamily="Inter, system-ui, sans-serif"
          >
            / 100
          </text>
        )}
      </svg>
      {/* Label beneath (md/lg only) */}
      {showLabel && label && size !== 'sm' && (
        <div className="text-center">
          <div className="text-[11px] text-slate-400 font-medium leading-tight">{label}</div>
          {weight != null && (
            <div className="text-[10px] text-slate-600">{weight}%</div>
          )}
        </div>
      )}
    </div>
  )
}

export { DIMENSION_COLORS as DIMENSION_COLOR_HEX }
export default ScoreGauge
