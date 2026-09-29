// One status message at a time, announced to screen readers without moving focus.
import { createContext, type ComponentChildren } from 'preact'
import { useCallback, useContext, useRef, useState } from 'preact/hooks'

type Toast = { text: string; kind: 'info' | 'error' }
const ToastContext = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})

export function ToastProvider({ children }: { children: ComponentChildren }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number>()
  const show = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    window.clearTimeout(timer.current)
    setToast({ text, kind })
    timer.current = window.setTimeout(() => setToast(null), 4500)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div class="toast-region" role="status" aria-live="polite">
        {toast && <div class={`toast ${toast.kind === 'error' ? 'error' : ''}`}>{toast.text}</div>}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
