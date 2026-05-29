import { db, type LocalCompanySettings } from '@/core/db/dexie'
import type { CompanySettings } from '../types'

export class CompanyLocalRepository {
  async get(orgId: string): Promise<CompanySettings | undefined> {
    const record = await db.companySettings.where('org_id').equals(orgId).first()
    if (!record) return undefined
    return this.toEntity(record)
  }

  async upsert(settings: CompanySettings & { _syncStatus?: string }): Promise<void> {
    const record: LocalCompanySettings = {
      ...settings,
      _syncStatus: (settings._syncStatus as LocalCompanySettings['_syncStatus']) ?? 'pending',
    }
    // Evitar duplicados: modificar si existe, insertar si no (igual que upsertById)
    const updated = await db.companySettings.where('id').equals(record.id).modify(record)
    if (updated === 0) {
      // También limpiar duplicados por org_id antes de insertar
      await db.companySettings.where('org_id').equals(record.org_id).delete()
      await db.companySettings.put(record)
    }
  }

  private toEntity(record: LocalCompanySettings): CompanySettings {
    return {
      id: record.id,
      org_id: record.org_id,
      trade_name: record.trade_name,
      legal_name: record.legal_name,
      tax_id: record.tax_id,
      address: record.address,
      phone: record.phone,
      email: record.email,
      logo_url: record.logo_url,
      currency: record.currency,
      currency_symbol: record.currency_symbol,
      tax_rate: record.tax_rate,
      tax_label: record.tax_label,
      invoice_series: record.invoice_series,
      receipt_series: record.receipt_series,
      po_series: record.po_series,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }
  }
}

export const companyLocalRepo = new CompanyLocalRepository()
