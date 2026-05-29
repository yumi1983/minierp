import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { LocalCashSession, LocalCashMovement, LocalCashRegister } from '@/core/db/dexie'

export type { LocalCashSession, LocalCashMovement }

export function useCashRegister() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const openSession = useLiveQuery(
    () => orgId
      ? db.cashSessions.where('org_id').equals(orgId).filter(s => s.status === 'open').first()
      : undefined,
    [orgId]
  ) as LocalCashSession | undefined

  const sessions = useLiveQuery(
    () => orgId
      ? db.cashSessions.where('org_id').equals(orgId)
          .toArray()
          .then(rows => {
            const seen = new Map<string, LocalCashSession>()
            for (const r of rows) {
              const prev = seen.get(r.id)
              if (!prev || (r._localId ?? 0) > (prev._localId ?? 0)) seen.set(r.id, r)
            }
            return Array.from(seen.values()).sort(
              (a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
            )
          })
      : [],
    [orgId], []
  ) as LocalCashSession[]

  const movements = useLiveQuery(
    () => openSession
      ? db.cashMovements.where('session_id').equals(openSession.id).toArray()
          .then(rows => {
            const seen = new Map<string, LocalCashMovement>()
            for (const r of rows) {
              const prev = seen.get(r.id)
              if (!prev || (r._localId ?? 0) > (prev._localId ?? 0)) seen.set(r.id, r)
            }
            return Array.from(seen.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          })
      : [],
    [openSession?.id], []
  ) as LocalCashMovement[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data: sessData, error: e1 } = await supabase
        .from('cash_sessions').select('*').eq('org_id', orgId)
      if (e1) throw e1
      for (const r of sessData ?? []) await upsertById(db.cashSessions, { ...r, _syncStatus: 'synced' })

      const { data: movData, error: e2 } = await supabase
        .from('cash_movements').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(200)
      if (e2) throw e2
      for (const r of movData ?? []) await upsertById(db.cashMovements, { ...r, _syncStatus: 'synced' })

      const { data: regData, error: e3 } = await supabase
        .from('cash_registers').select('*').eq('org_id', orgId)
      if (e3) throw e3
      for (const r of regData ?? []) await upsertById(db.cashRegisters, { ...r, _syncStatus: 'synced' })
    } catch (err) {
      console.error('[useCashRegister] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const ensureRegister = async (): Promise<string> => {
    if (!orgId) throw new Error('Sin sesión')
    let reg = await db.cashRegisters.where('org_id').equals(orgId).first()
    if (!reg) {
      const newReg: LocalCashRegister = {
        id: generateUUID(), org_id: orgId, name: 'Caja Principal',
        is_active: true, created_at: new Date().toISOString(), _syncStatus: 'pending',
      }
      await db.cashRegisters.put(newReg)
      await syncQueue.enqueue('cash_registers', 'INSERT', newReg as unknown as Record<string, unknown>)
      reg = newReg
    }
    return reg.id
  }

  const openCash = async (openingAmount: number) => {
    if (!orgId || !user) throw new Error('Sin sesión activa')
    const existing = await db.cashSessions.where('org_id').equals(orgId).filter(s => s.status === 'open').first()
    if (existing) throw new Error('Ya hay una caja abierta')

    const registerId = await ensureRegister()
    const session: LocalCashSession = {
      id: generateUUID(), org_id: orgId, register_id: registerId,
      user_id: user.id, opening_amount: openingAmount,
      closing_amount: null, expected_amount: null, difference: null,
      opened_at: new Date().toISOString(), closed_at: null,
      status: 'open', _syncStatus: 'pending',
    }
    await db.cashSessions.put(session)
    await syncQueue.enqueue('cash_sessions', 'INSERT', session as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Caja abierta correctamente')
  }

  const closeCash = async (closingAmount: number) => {
    if (!orgId || !openSession) throw new Error('No hay caja abierta')

    const income = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0)
    const expense = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
    const expectedAmount = openSession.opening_amount + income - expense
    const difference = closingAmount - expectedAmount
    const now = new Date().toISOString()

    await db.cashSessions.where('id').equals(openSession.id).modify({
      closing_amount: closingAmount, expected_amount: expectedAmount,
      difference, closed_at: now, status: 'closed', _syncStatus: 'pending',
    })
    const updated = await db.cashSessions.where('id').equals(openSession.id).first()
    if (updated) {
      await syncQueue.enqueue('cash_sessions', 'UPDATE', updated as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Caja cerrada correctamente')
  }

  const addMovement = async (params: { type: 'income' | 'expense'; amount: number; description: string }) => {
    if (!orgId || !user || !openSession) throw new Error('No hay caja abierta')
    if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0')

    const movement: LocalCashMovement = {
      id: generateUUID(), org_id: orgId, session_id: openSession.id,
      type: params.type, amount: params.amount,
      description: params.description,
      reference_type: null, reference_id: null,
      user_id: user.id, created_at: new Date().toISOString(), _syncStatus: 'pending',
    }
    await db.cashMovements.put(movement)
    await syncQueue.enqueue('cash_movements', 'INSERT', movement as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)

    const label = params.type === 'income' ? 'Ingreso' : 'Egreso'
    toast.success(`${label} registrado`)
  }

  const getSessionMovements = async (sessionId: string): Promise<LocalCashMovement[]> => {
    const rows = await db.cashMovements.where('session_id').equals(sessionId).toArray()
    const seen = new Map<string, LocalCashMovement>()
    for (const r of rows) {
      const prev = seen.get(r.id)
      if (!prev || (r._localId ?? 0) > (prev._localId ?? 0)) seen.set(r.id, r)
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  return { openSession, sessions, movements, loading, load, openCash, closeCash, addMovement, getSessionMovements }
}
