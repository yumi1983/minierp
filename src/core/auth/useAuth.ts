import { useAuthStore } from './authStore'
import { supabase } from '@/core/supabase/client'

export function useAuth() {
  const { user, orgId, role, isLoading, clear } = useAuthStore()

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clear()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  return {
    user,
    orgId,
    role,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signOut,
    resetPassword,
  }
}
