import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { Brand, CreateBrandDto } from '../types'

export function useBrands() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const brands = useLiveQuery(
    () => orgId
      ? db.brands
          .where('org_id').equals(orgId)
          .filter(b => !b.deleted_at)
          .sortBy('name')
      : [],
    [orgId],
    []
  ) as Brand[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('brands').select('*').eq('org_id', orgId).is('deleted_at', null)
      if (error) throw error
      if (data) {
        for (const row of data) await upsertById(db.brands, { ...row, _syncStatus: 'synced' })
      }
    } catch (err) {
      console.error('[useBrands] load error:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const create = async (dto: CreateBrandDto) => {
    if (!orgId) return
    const now = new Date().toISOString()
    const record: Brand = {
      id: generateUUID(), org_id: orgId, name: dto.name,
      created_at: now, deleted_at: null,
    }
    await db.brands.put({ ...record, _syncStatus: 'pending' })
    await syncQueue.enqueue('brands', 'INSERT', record as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Marca creada')
  }

  const update = async (id: string, dto: CreateBrandDto) => {
    if (!orgId) return
    const existing = await db.brands.where('id').equals(id).first()
    if (!existing) return
    const updated = { ...existing, ...dto }
    await db.brands.put({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('brands', 'UPDATE', updated as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Marca actualizada')
  }

  const remove = async (id: string) => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.brands.where('id').equals(id).modify({ deleted_at: now, _syncStatus: 'pending' })
    const record = await db.brands.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('brands', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Marca eliminada')
  }

  return { brands, loading, load, create, update, remove }
}
