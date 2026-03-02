import clsx from 'clsx'

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50',
  orange: 'text-orange-600 bg-orange-50',
  purple: 'text-purple-600 bg-purple-50',
  teal: 'text-teal-600 bg-teal-50',
  emerald: 'text-emerald-600 bg-emerald-50',
  amber: 'text-amber-600 bg-amber-50',
}

interface StatCardProps {
  label: string
  value: number | string
  color: string
  icon?: React.ElementType
  urgent?: boolean
}

export function StatCard({ label, value, color, icon: Icon, urgent }: StatCardProps) {
  const colorClasses = COLOR_MAP[color] || COLOR_MAP.blue

  if (Icon) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', color.startsWith('bg-') ? color : `bg-${color}-500`)}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('card p-4', urgent && Number(value) > 0 && 'border-orange-200 bg-orange-50/30')}>
      <div className={clsx('text-2xl font-bold w-10 h-10 rounded-lg flex items-center justify-center text-sm mb-2', colorClasses)}>
        {value}
      </div>
      <div className="text-xs text-gray-600 font-medium">{label}</div>
    </div>
  )
}
