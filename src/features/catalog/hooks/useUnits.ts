import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { Unit, CreateUnitDto } from '../types'

export function useUnits() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const units = useLiveQuery(
    () => orgId
      ? db.units.where('org_id').equals(orgId).sortBy('name')
      : [],
    [orgId],
    []
  ) as Unit[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('units_of_measure').select('*').eq('org_id', orgId)
      if (error) throw error
      if (data) {
        for (const row of data) await upsertById(db.units, { ...row, _syncStatus: 'synced' })
      }
    } catch (err) {
      console.error('[useUnits] load error:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const create = async (dto: CreateUnitDto) => {
    if (!orgId) return
    const record: Unit = {
      id: generateUUID(), org_id: orgId,
      name: dto.name, abbreviation: dto.abbreviation,
      created_at: new Date().toISOString(),
    }
    await db.units.put({ ...record, _syncStatus: 'pending' })
    await syncQueue.enqueue('units_of_measure', 'INSERT', record as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Unidad creada')
  }

  const update = async (id: string, dto: CreateUnitDto) => {
    if (!orgId) return
    const existing = await db.units.where('id').equals(id).first()
    if (!existing) return
    const updated = { ...existing, ...dto }
    await db.units.put({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('units_of_measure', 'UPDATE', updated as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Unidad actualizada')
  }

  const remove = async (id: string) => {
    if (!orgId) return
    await db.units.where('id').equals(id).delete()
    await supabase.from('units_of_measure').delete().eq('id', id)
    toast.success('Unidad eliminada')
  }

  return { units, loading, load, create, update, remove }
}
