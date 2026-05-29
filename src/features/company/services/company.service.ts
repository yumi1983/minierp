import { generateUUID } from '@/shared/utils/uuid'
import { syncQueue } from '@/core/sync/SyncQueue'
import { companyLocalRepo } from '../repositories/company.local.repo'
import { companyRemoteRepo } from '../repositories/company.remote.repo'
import type { CompanySettings, UpdateCompanyDto } from '../types'

export class CompanyService {
  async load(orgId: string): Promise<CompanySettings | null> {
    // 1. Intentar local primero
    const local = await companyLocalRepo.get(orgId)
    if (local) return local

    // 2. Si no hay local, buscar remoto
    const remote = await companyRemoteRepo.get(orgId)
    if (remote) {
      await companyLocalRepo.upsert({ ...remote, _syncStatus: 'synced' })
      return remote
    }

    return null
  }

  async save(orgId: string, dto: UpdateCompanyDto, existingId?: string): Promise<CompanySettings> {
    const now = new Date().toISOString()
    const id = existingId ?? generateUUID()

    const settings: CompanySettings = {
      id,
      org_id: orgId,
      ...dto,
      created_at: now,
      updated_at: now,
    }

    // Guardar local inmediatamente
    await companyLocalRepo.upsert(settings)

    // Encolar sincronización
    await syncQueue.enqueue(
      'company_settings',
      existingId ? 'UPDATE' : 'INSERT',
      settings as unknown as Record<string, unknown>
    )

    return settings
  }

  async uploadLogo(orgId: string, file: File): Promise<string> {
    return companyRemoteRepo.uploadLogo(orgId, file)
  }
}

export const companyService = new CompanyService()
