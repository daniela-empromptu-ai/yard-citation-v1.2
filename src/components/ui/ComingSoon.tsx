import { PageHeader } from './PageHeader'

interface Props {
  title: string
  description: string
}

export function ComingSoon({ title, description }: Props) {
  const cardCopy = title
    ? "This view is part of the upcoming UI revamp. The data path is not yet wired up — we're matching the target IA so the rest of the app lays out correctly around it."
    : description

  return (
    <div>
      {title ? <PageHeader title={title} subtitle={description} /> : null}
      <div
        className="rounded-xl p-12 flex flex-col items-center justify-center text-center"
        style={{
          background: 'var(--bg-surface)',
          border: '1px dashed var(--border-default)',
        }}
      >
        <div
          className="text-[10px] font-semibold tracking-widest uppercase mb-2"
          style={{ color: 'var(--accent)' }}
        >
          Mocked
        </div>
        <div className="text-[15px] mb-1" style={{ color: 'var(--text-primary)' }}>
          Preview only
        </div>
        <div className="text-[13px] max-w-md" style={{ color: 'var(--text-secondary)' }}>
          {cardCopy}
        </div>
      </div>
    </div>
  )
}
