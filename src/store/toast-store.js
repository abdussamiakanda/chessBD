import { create } from 'zustand'

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    const duration = toast.duration ?? 3000
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))


