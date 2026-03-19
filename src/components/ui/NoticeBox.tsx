import clsx from 'clsx'

const VARIANTS = {
  info: 'bg-blue-900/20 border-blue-700/40 text-blue-400',
  warning: 'bg-amber-900/20 border-amber-700/40 text-amber-400',
  danger: 'bg-red-900/20 border-red-700/40 text-red-400',
}

interface NoticeBoxProps {
  children: React.ReactNode
  variant?: keyof typeof VARIANTS
}

export function NoticeBox({ children, variant = 'warning' }: NoticeBoxProps) {
  return (
    <div className={clsx('flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm', VARIANTS[variant])}>
      {children}
    </div>
  )
}
