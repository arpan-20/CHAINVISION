import { create } from 'zustand'

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  variant: ToastVariant
  message: string
}

interface ToastState {
  toasts: Toast[]
  pushToast: (variant: ToastVariant, message: string) => void
  dismissToast: (id: string) => void
}

const AUTO_DISMISS_MS = 5000

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  pushToast: (variant, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((state) => ({ toasts: [...state.toasts, { id, variant, message }] }))

    setTimeout(() => {
      get().dismissToast(id)
    }, AUTO_DISMISS_MS)
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))

// Convenience export so non-component code (e.g. apiInterceptor.ts) can
// push a toast without needing a React hook context.
export const pushToast = (variant: ToastVariant, message: string): void => {
  useToastStore.getState().pushToast(variant, message)
}

// Hook form for use inside components.
export const useToast = () => {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)
  return { toasts, dismissToast, pushToast }
}