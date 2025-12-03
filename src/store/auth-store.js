import { create } from 'zustand'
import { auth } from '../lib/firebase'

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    if (auth) {
      const { signOut: firebaseSignOut } = await import('firebase/auth')
      await firebaseSignOut(auth)
    }
    set({ user: null })
  },
}))


