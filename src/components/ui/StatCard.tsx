import clsx from 'clsx'

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-400 bg-blue-900/30',
  green: 'text-green-400 bg-green-900/30',
  orange: 'text-orange-400 bg-orange-900/30',
  purple: 'text-purple-400 bg-purple-900/30',
  teal: 'text-teal-400 bg-teal-900/30',
  emerald: 'text-emerald-400 bg-emerald-900/30',
  amber: 'text-amber-400 bg-amber-900/30',
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
      <div className="bg-[#1e293b] border border-[#2d3748] rounded-xl p-4 flex items-start gap-3">
        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', color.startsWith('bg-') ? color : `bg-${color}-500`)}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-100">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('card p-4', urgent && Number(value) > 0 && 'border-orange-700/50 bg-orange-900/20')}>
      <div className={clsx('text-2xl font-bold w-10 h-10 rounded-lg flex items-center justify-center text-sm mb-2', colorClasses)}>
        {value}
      </div>
      <div className="text-xs text-slate-400 font-medium">{label}</div>
    </div>
  )
}
