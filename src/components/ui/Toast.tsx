'use client'

import { showToast } from './Toaster'

export function useToast() {
  const addToast = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    showToast(type, message)
  }
  return { addToast }
}
