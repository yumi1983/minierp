import { useEffect, type ReactNode } from 'react'
import { supabase } from '@/core/supabase/client'
import { useAuthStore } from './authStore'
import { companyService } from '@/features/company/services/company.service'
import { useCompanyStore } from '@/features/company/store/company.store'
import type { UserRole } from '@/shared/types/common.types'

interface Props {
  children: ReactNode
}

export function AuthProvider({ children }: Props) {
  const { setUser, setOrgId, setRole, setLoading, clear } = useAuthStore()
  const { setSettings } = useCompanyStore()

  useEffect(() => {
    // Timeout de seguridad: si todo se cuelga, desbloquear en 5s
    const safetyTimer = setTimeout(() => {
      setLoading(false)
    }, 5000)

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      clearTimeout(safetyTimer)

      if (error || !session?.user) {
        clear()
        setLoading(false)
        return
      }

      // Desbloquear UI inmediatamente — el orgId persiste en localStorage
      setUser(session.user)
      setLoading(false)

      // Cargar perfil en segundo plano sin bloquear
      loadProfile(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        setLoading(false)
        loadProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        clearTimeout(safetyTimer)
        clear()
        setLoading(false)
      }
    })

    return () => {
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('org_id, role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('[AuthProvider] loadProfile:', error.message)
        return
      }
      if (data) {
        setOrgId(data.org_id)
        setRole(data.role as UserRole)
        // Cargar company settings globalmente para que estén disponibles
        // en PDF, reportes y cualquier módulo sin necesidad de visitar /company
        loadCompanySettings(data.org_id)
      }
    } catch (err) {
      console.error('[AuthProvider] loadProfile exception:', err)
    }
  }

  async function loadCompanySettings(orgId: string) {
    try {
      const settings = await companyService.load(orgId)
      if (settings) setSettings(settings)
    } catch (err) {
      console.error('[AuthProvider] loadCompanySettings:', err)
    }
  }

  return <>{children}</>
}
