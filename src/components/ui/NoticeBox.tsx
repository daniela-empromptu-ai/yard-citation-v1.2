import clsx from 'clsx'

const VARIANTS = {
  info: 'bg-blue-50 border-blue-200 text-blue-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  danger: 'bg-red-50 border-red-200 text-red-700',
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
