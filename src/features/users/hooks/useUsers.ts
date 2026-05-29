import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import type { LocalUserProfile } from '@/core/db/dexie'

export type UserRole = 'admin' | 'seller' | 'warehouse' | 'accounting'

export function useUsers() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const users = useLiveQuery(
    () => orgId
      ? db.userProfiles.where('org_id').equals(orgId).toArray()
          .then(rows => {
            const seen = new Map<string, LocalUserProfile>()
            for (const r of rows) {
              const prev = seen.get(r.id)
              if (!prev || (r._localId ?? 0) > (prev._localId ?? 0)) seen.set(r.id, r)
            }
            return Array.from(seen.values()).sort(
              (a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')
            )
          })
      : [],
    [orgId], []
  ) as LocalUserProfile[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('org_id', orgId)
      if (error) throw error
      for (const row of data ?? []) {
        await upsertById(db.userProfiles, { ...row, _syncStatus: 'synced' })
      }
    } catch (err) {
      console.error('[useUsers] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const updateRole = async (userId: string, role: UserRole) => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.userProfiles.where('id').equals(userId).modify({ role, updated_at: now, _syncStatus: 'pending' })
    const record = await db.userProfiles.where('id').equals(userId).first()
    if (record) {
      await syncQueue.enqueue('user_profiles', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Rol actualizado')
  }

  const toggleActive = async (userId: string, isActive: boolean) => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.userProfiles.where('id').equals(userId).modify({ is_active: isActive, updated_at: now, _syncStatus: 'pending' })
    const record = await db.userProfiles.where('id').equals(userId).first()
    if (record) {
      await syncQueue.enqueue('user_profiles', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success(isActive ? 'Usuario activado' : 'Usuario desactivado')
  }

  return { users, loading, load, updateRole, toggleActive }
}
