import { supabase } from '@/core/supabase/client'
import type { CompanySettings } from '../types'

export class CompanyRemoteRepository {
  async get(orgId: string): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('org_id', orgId)
      .single()

    if (error || !data) return null
    return data as CompanySettings
  }

  async upsert(settings: Partial<CompanySettings> & { org_id: string }): Promise<CompanySettings | null> {
    const { data, error } = await supabase
      .from('company_settings')
      .upsert(settings, { onConflict: 'org_id' })
      .select()
      .single()

    if (error) throw error
    return data as CompanySettings
  }

  async uploadLogo(orgId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `logos/${orgId}.${ext}`

    const { error } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { upsert: true })

    if (error) throw error

    const { data } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path)

    return data.publicUrl
  }
}

export const companyRemoteRepo = new CompanyRemoteRepository()
