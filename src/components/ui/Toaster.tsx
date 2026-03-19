'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

let toastListeners: ((toast: Toast) => void)[] = []

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = { id: Date.now().toString(), type, message }
  toastListeners.forEach(fn => fn(toast))
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts(prev => [...prev, toast])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, 4000)
  }, [])

  useEffect(() => {
    toastListeners.push(addToast)
    return () => {
      toastListeners = toastListeners.filter(fn => fn !== addToast)
    }
  }, [addToast])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg border max-w-sm animate-fade-in ${
            t.type === 'success' ? 'bg-green-900/40 border-green-700/50' :
            t.type === 'error' ? 'bg-red-900/40 border-red-700/50' :
            t.type === 'warning' ? 'bg-amber-900/40 border-amber-700/50' :
            'bg-blue-900/40 border-blue-700/50'
          }`}
        >
          {t.type === 'success' && <CheckCircle size={16} className="text-green-400 mt-0.5 shrink-0" />}
          {t.type === 'error' && <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />}
          <span className={`text-sm flex-1 ${
            t.type === 'success' ? 'text-green-300' :
            t.type === 'error' ? 'text-red-300' :
            t.type === 'warning' ? 'text-amber-300' :
            'text-blue-300'
          }`}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
