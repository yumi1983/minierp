import { create } from 'zustand'
import type { CompanySettings } from '../types'

interface CompanyState {
  settings: CompanySettings | null
  isLoading: boolean
  setSettings: (s: CompanySettings | null) => void
  setLoading: (v: boolean) => void
}

export const useCompanyStore = create<CompanyState>((set) => ({
  settings: null,
  isLoading: false,
  setSettings: (settings) => set({ settings }),
  setLoading: (isLoading) => set({ isLoading }),
}))
