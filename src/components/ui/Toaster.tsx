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
            t.type === 'success' ? 'bg-green-50 border-green-200' :
            t.type === 'error' ? 'bg-red-50 border-red-200' :
            t.type === 'warning' ? 'bg-amber-50 border-amber-200' :
            'bg-blue-50 border-blue-200'
          }`}
        >
          {t.type === 'success' && <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />}
          {t.type === 'error' && <XCircle size={16} className="text-red-600 mt-0.5 shrink-0" />}
          <span className={`text-sm flex-1 ${
            t.type === 'success' ? 'text-green-800' :
            t.type === 'error' ? 'text-red-800' :
            t.type === 'warning' ? 'text-amber-800' :
            'text-blue-800'
          }`}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
