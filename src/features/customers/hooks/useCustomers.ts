import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { Customer, CreateCustomerDto } from '../types'

export function useCustomers() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const customers = useLiveQuery(
    () => orgId
      ? db.customers
          .where('org_id').equals(orgId)
          .filter(c => !c.deleted_at)
          .toArray()
          .then(rows => {
            // Deduplicar por id (protección contra duplicados en IndexedDB)
            const seen = new Map<string, (typeof rows)[number]>()
            for (const row of rows) {
              const prev = seen.get(row.id)
              if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
            }
            return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
          })
      : [],
    [orgId],
    []
  ) as Customer[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
      if (error) throw error
      if (data) {
        // upsertById evita duplicados en cada refresh (lección aprendida)
        for (const row of data) {
          await upsertById(db.customers, { ...row, _syncStatus: 'synced' })
        }
      }
    } catch (err) {
      console.error('[useCustomers] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const create = async (dto: CreateCustomerDto): Promise<Customer> => {
    if (!orgId) throw new Error('Sin organización')
    const now = new Date().toISOString()
    const customer: Customer = {
      id: generateUUID(),
      org_id: orgId,
      name: dto.name,
      tax_id: dto.tax_id || null,
      phone: dto.phone || null,
      email: dto.email || null,
      address: dto.address || null,
      credit_limit: dto.credit_limit,
      notes: dto.notes || null,
      is_active: dto.is_active,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    await db.customers.put({ ...customer, _syncStatus: 'pending' })
    await syncQueue.enqueue('customers', 'INSERT', customer as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Cliente creado')
    return customer
  }

  const update = async (id: string, dto: Partial<CreateCustomerDto>): Promise<void> => {
    if (!orgId) return
    const existing = await db.customers.where('id').equals(id).first()
    if (!existing) return
    const updated: Customer = {
      ...existing,
      ...dto,
      tax_id: dto.tax_id !== undefined ? (dto.tax_id || null) : existing.tax_id,
      phone: dto.phone !== undefined ? (dto.phone || null) : existing.phone,
      email: dto.email !== undefined ? (dto.email || null) : existing.email,
      address: dto.address !== undefined ? (dto.address || null) : existing.address,
      notes: dto.notes !== undefined ? (dto.notes || null) : existing.notes,
      updated_at: new Date().toISOString(),
    }
    await db.customers.where('id').equals(id).modify({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('customers', 'UPDATE', updated as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Cliente actualizado')
  }

  const remove = async (id: string): Promise<void> => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.customers.where('id').equals(id).modify({ deleted_at: now, _syncStatus: 'pending' })
    const record = await db.customers.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('customers', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Cliente eliminado')
  }

  return { customers, loading, load, create, update, remove }
}
