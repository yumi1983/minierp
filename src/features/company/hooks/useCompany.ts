import { useEffect } from 'react'
import { useAuth } from '@/core/auth/useAuth'
import { syncEngine } from '@/core/sync/SyncEngine'
import { companyService } from '../services/company.service'
import { useCompanyStore } from '../store/company.store'
import type { UpdateCompanyDto } from '../types'

export function useCompany() {
  const { orgId, isLoading: authLoading } = useAuth()
  const { settings, isLoading, setSettings, setLoading } = useCompanyStore()

  useEffect(() => {
    if (authLoading) return

    if (!orgId) {
      setLoading(false)
      return
    }

    setLoading(true)
    companyService
      .load(orgId)
      .then((data) => setSettings(data))
      .catch((err) => console.error('[useCompany] Error:', err))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, authLoading])

  const save = async (dto: UpdateCompanyDto) => {
    if (!orgId) throw new Error('No hay organización activa')
    const saved = await companyService.save(orgId, dto, settings?.id)
    setSettings(saved)
    if (navigator.onLine) syncEngine.flush(orgId)
    return saved
  }

  const uploadLogo = async (file: File): Promise<string> => {
    if (!orgId) throw new Error('No hay organización activa')
    return companyService.uploadLogo(orgId, file)
  }

  return { settings, isLoading, save, uploadLogo }
}
