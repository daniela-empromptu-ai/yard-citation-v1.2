'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({ open, onClose, title, children, width = '480px' }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <div
        className={clsx(
          'drawer transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        style={{ width }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </>
  )
}

export default Drawer
