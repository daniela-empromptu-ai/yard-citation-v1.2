interface RubricScores {
  score_technical_relevance: number
  score_audience_alignment: number
  score_content_quality: number
  score_channel_performance: number
  score_brand_fit: number
}

const DIMENSIONS: { key: keyof RubricScores; label: string }[] = [
  { key: 'score_technical_relevance', label: 'Technical Relevance' },
  { key: 'score_audience_alignment', label: 'Audience Alignment' },
  { key: 'score_content_quality', label: 'Content Quality' },
  { key: 'score_channel_performance', label: 'Channel Performance' },
  { key: 'score_brand_fit', label: 'Brand Fit' },
]

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-400'
  return 'bg-red-400'
}

export default function RubricBars({ scores }: { scores: RubricScores }) {
  return (
    <div className="space-y-2">
      {DIMENSIONS.map(({ key, label }) => {
        const value = scores[key] ?? 0
        return (
          <div key={key} className="dim-bar">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-gray-600">{label}</span>
              <span className="text-xs font-medium text-gray-800">{value}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${scoreColor(value)}`}
                style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
