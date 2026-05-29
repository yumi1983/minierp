import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/shared/types/common.types'

interface AuthState {
  user: User | null
  orgId: string | null
  role: UserRole | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setOrgId: (orgId: string | null) => void
  setRole: (role: UserRole | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      orgId: null,
      role: null,
      isLoading: true,
      setUser: (user) => set({ user }),
      setOrgId: (orgId) => set({ orgId }),
      setRole: (role) => set({ role }),
      setLoading: (isLoading) => set({ isLoading }),
      clear: () => set({ user: null, orgId: null, role: null, isLoading: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ orgId: state.orgId, role: state.role }),
    }
  )
)
