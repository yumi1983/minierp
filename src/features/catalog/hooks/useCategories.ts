import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { Category, CreateCategoryDto } from '../types'

export function useCategories() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const categories = useLiveQuery(
    () => orgId
      ? db.categories
          .where('org_id').equals(orgId)
          .filter(c => !c.deleted_at)
          .sortBy('name')
      : [],
    [orgId],
    []
  ) as Category[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
      if (error) throw error
      if (data) {
        for (const row of data) {
          await upsertById(db.categories, { ...row, _syncStatus: 'synced' })
        }
      }
    } catch (err) {
      console.error('[useCategories] load error:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const create = async (dto: CreateCategoryDto) => {
    if (!orgId) return
    const now = new Date().toISOString()
    const record: Category = {
      id: generateUUID(), org_id: orgId,
      name: dto.name, description: dto.description ?? null,
      parent_id: dto.parent_id ?? null,
      created_at: now, updated_at: now, deleted_at: null,
    }
    await db.categories.put({ ...record, _syncStatus: 'pending' })
    await syncQueue.enqueue('categories', 'INSERT', record as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Categoría creada')
  }

  const update = async (id: string, dto: Partial<CreateCategoryDto>) => {
    if (!orgId) return
    const existing = await db.categories.where('id').equals(id).first()
    if (!existing) return
    const updated = { ...existing, ...dto, updated_at: new Date().toISOString() }
    await db.categories.put({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('categories', 'UPDATE', updated as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Categoría actualizada')
  }

  const remove = async (id: string) => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.categories.where('id').equals(id).modify({ deleted_at: now, _syncStatus: 'pending' })
    const record = await db.categories.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('categories', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Categoría eliminada')
  }

  return { categories, loading, load, create, update, remove }
}
