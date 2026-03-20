import React from 'react'

interface EmptyStateAction {
  label: string
  onClick: () => void
  loading?: boolean
}

interface EmptyStateProps {
  icon?: string | React.ElementType
  title: string
  description?: string
  action?: EmptyStateAction
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  const IconComponent = typeof icon === 'function' ? (icon as React.ElementType) : null;
  const iconStr = typeof icon === 'string' ? icon : null;
  return (
    <div className={`text-center ${compact ? 'py-8' : 'py-16'}`}>
      {IconComponent ? (
        <div className="flex justify-center mb-3">
          <IconComponent size={36} className="text-slate-600" />
        </div>
      ) : iconStr ? (
        <div className="text-4xl mb-3">{iconStr}</div>
      ) : null}
      <div className="text-slate-500 font-medium text-sm">{title}</div>
      {description && <p className="text-slate-400 text-xs mt-1">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          disabled={action.loading}
          className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {action.loading ? 'Loading\u2026' : action.label}
        </button>
      )}
    </div>
  )
}
