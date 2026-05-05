interface PageHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, eyebrow, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        {eyebrow && (
          <div
            className="flex items-center gap-2 mb-3 text-[11px] font-semibold tracking-widest uppercase"
            style={{ color: 'var(--accent)' }}
          >
            <span className="inline-block w-6 h-px" style={{ background: 'var(--accent)' }} />
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 mt-1">{actions}</div>}
    </div>
  )
}
