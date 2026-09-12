import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type Modal =
  | null
  | { kind: 'signin' }
  | { kind: 'settings' }
  | { kind: 'github-write'; url: string; title?: string }

type Toast = { id: number; text: string; tone: 'info' | 'success' | 'error' }

type UIValue = {
  modal: Modal
  openSignIn: () => void
  openSettings: () => void
  openGithubWrite: (url: string, title?: string) => void
  closeModal: () => void
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

const UIContext = createContext<UIValue | null>(null)

let toastSeq = 0

export function UIProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<Modal>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (text: string, tone: Toast['tone'] = 'info') => {
      const id = ++toastSeq
      setToasts((prev) => [...prev.slice(-3), { id, text, tone }])
      window.setTimeout(() => dismissToast(id), tone === 'error' ? 6500 : 4000)
    },
    [dismissToast],
  )

  const value = useMemo<UIValue>(
    () => ({
      modal,
      openSignIn: () => setModal({ kind: 'signin' }),
      openSettings: () => setModal({ kind: 'settings' }),
      openGithubWrite: (url, title) => setModal({ kind: 'github-write', url, title }),
      closeModal: () => setModal(null),
      toasts,
      toast,
      dismissToast,
    }),
    [modal, toasts, toast, dismissToast],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI(): UIValue {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI должен вызываться внутри <UIProvider>')
  return ctx
}
