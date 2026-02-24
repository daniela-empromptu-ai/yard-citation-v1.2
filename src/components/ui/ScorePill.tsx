import clsx from 'clsx'

interface ScorePillProps {
  score: number | null;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: 'text-green-700', bg: 'bg-green-100', bar: 'bg-green-500', border: 'border-green-200' }
  if (score >= 65) return { text: 'text-amber-700', bg: 'bg-amber-100', bar: 'bg-amber-500', border: 'border-amber-200' }
  return { text: 'text-red-700', bg: 'bg-red-100', bar: 'bg-red-500', border: 'border-red-200' }
}

export function ScorePill({ score: scoreProp, size = 'sm', showBar = false }: ScorePillProps) {
  const score = scoreProp ?? 0
  const c = getScoreColor(score)
  return (
    <div className={clsx('inline-flex flex-col items-center gap-0.5', size === 'lg' ? 'min-w-[64px]' : '')}>
      <span className={clsx(
        'inline-flex items-center justify-center rounded-full font-bold border',
        c.text, c.bg, c.border,
        size === 'sm' ? 'text-[11px] px-2 py-0.5 min-w-[36px]' :
        size === 'md' ? 'text-sm px-2.5 py-1 min-w-[44px]' :
        'text-base px-3 py-1.5 min-w-[52px]'
      )}>
        {score}
      </span>
      {showBar && (
        <div className="dim-bar w-full">
          <div className={clsx('dim-bar-fill', c.bar)} style={{ width: `${score}%` }} />
        </div>
      )}
    </div>
  )
}

export default ScorePill

interface RubricBarsProps {
  scores: {
    technical_relevance: number;
    audience_alignment: number;
    content_quality: number;
    channel_performance: number;
    brand_fit: number;
  }
}

export function RubricBars({ scores }: RubricBarsProps) {
  const dims = [
    { key: 'technical_relevance', label: 'Technical Relevance', weight: 30 },
    { key: 'audience_alignment', label: 'Audience Alignment', weight: 25 },
    { key: 'content_quality', label: 'Content Quality', weight: 20 },
    { key: 'channel_performance', label: 'Channel Performance', weight: 15 },
    { key: 'brand_fit', label: 'Brand Fit', weight: 10 },
  ]
  return (
    <div className="space-y-3">
      {dims.map(d => {
        const score = scores[d.key as keyof typeof scores] || 0
        const c = getScoreColor(score)
        return (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600 font-medium">{d.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{d.weight}% weight</span>
                <span className={clsx('text-xs font-bold', c.text)}>{score}</span>
              </div>
            </div>
            <div className="dim-bar">
              <div className={clsx('dim-bar-fill', c.bar)} style={{ width: `${score}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
