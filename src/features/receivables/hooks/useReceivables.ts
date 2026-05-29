import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db } from '@/core/db/dexie'
import type { LocalCreditAccount, LocalCreditPayment } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { CreditAccount, CreditPayment, CreditAccountWithDetail, PaymentHistoryEntry, PaymentMethod } from '../types'

// Retorna el registro más actualizado: pending gana sobre synced, luego _localId más alto
async function pickBestAccount(accountId: string): Promise<LocalCreditAccount | undefined> {
  const records = await db.creditAccounts.where('id').equals(accountId).toArray()
  if (records.length === 0) return undefined
  return records.sort((a, b) => {
    const ap = a._syncStatus === 'pending' ? 1 : 0
    const bp = b._syncStatus === 'pending' ? 1 : 0
    if (ap !== bp) return bp - ap
    return (b._localId ?? 0) - (a._localId ?? 0)
  })[0]
}

export function useReceivables() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const paymentHistory = useLiveQuery(
    async () => {
      if (!orgId) return []
      const all = await db.creditPayments.where('org_id').equals(orgId).toArray()

      // Deduplicar
      const seen = new Map<string, (typeof all)[number]>()
      for (const p of all) {
        const prev = seen.get(p.id)
        if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seen.set(p.id, p)
      }

      // Enriquecer con cuenta, cliente y venta
      const entries = await Promise.all(
        Array.from(seen.values()).map(async p => {
          const account = await db.creditAccounts.where('id').equals(p.credit_account_id).first()
          const customer = account
            ? await db.customers.where('id').equals(account.customer_id).first()
            : null
          const sale = account
            ? await db.sales.where('id').equals(account.sale_id).first()
            : null
          return {
            ...p,
            customer_id: account?.customer_id ?? '',
            customer_name: customer?.name ?? '—',
            sale_code: sale
              ? `${sale.series}-${String(sale.number).padStart(4, '0')}`
              : '—',
            total_amount: account?.total_amount ?? 0,
          } as PaymentHistoryEntry
        })
      )

      return entries.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    [orgId],
    []
  ) as PaymentHistoryEntry[]

  const accounts = useLiveQuery(
    async () => {
      if (!orgId) return []
      const rows = await db.creditAccounts.where('org_id').equals(orgId).toArray()

      const seen = new Map<string, (typeof rows)[number]>()
      for (const row of rows) {
        const prev = seen.get(row.id)
        if (!prev) { seen.set(row.id, row); continue }
        const rowPending = row._syncStatus === 'pending'
        const prevPending = prev._syncStatus === 'pending'
        if (rowPending && !prevPending) { seen.set(row.id, row); continue }
        if (!rowPending && !prevPending && (row._localId ?? 0) > (prev._localId ?? 0)) {
          seen.set(row.id, row)
        }
      }

      // Excluir cuentas cuya venta esté cancelada
      const result: (typeof rows)[number][] = []
      for (const account of seen.values()) {
        const sale = await db.sales.where('id').equals(account.sale_id).first()
        if (sale?.status === 'cancelled') continue
        result.push(account)
      }

      return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    [orgId],
    []
  ) as CreditAccount[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data: accData, error: err1 } = await supabase
        .from('credit_accounts')
        .select('*')
        .eq('org_id', orgId)
      if (err1) throw err1
      for (const row of accData ?? []) {
        const correctedStatus =
          Math.round(row.paid_amount * 100) >= Math.round(row.total_amount * 100) ? 'paid' : row.status
        const needsSupabaseUpdate = correctedStatus !== row.status
        const finalRow: LocalCreditAccount = {
          ...row,
          status: correctedStatus,
          _syncStatus: needsSupabaseUpdate ? 'pending' : 'synced',
        }
        // Transacción atómica: re-verifica pending dentro para evitar TOCTOU
        let didUpdate = false
        await db.transaction('rw', db.creditAccounts, async () => {
          const pendingCount = await db.creditAccounts.where('id').equals(row.id)
            .filter(r => r._syncStatus === 'pending').count()
          if (pendingCount > 0) return
          await db.creditAccounts.where('id').equals(row.id).delete()
          await db.creditAccounts.put(finalRow)
          didUpdate = true
        })
        if (didUpdate && needsSupabaseUpdate) {
          await syncQueue.enqueue('credit_accounts', 'UPDATE', finalRow as unknown as Record<string, unknown>)
        }
      }
      if (navigator.onLine) syncEngine.flush(orgId)

      const { data: pmtData, error: err2 } = await supabase
        .from('credit_payments')
        .select('*')
        .eq('org_id', orgId)
      if (err2) throw err2
      for (const row of pmtData ?? []) {
        await db.transaction('rw', db.creditPayments, async () => {
          const pendingCount = await db.creditPayments.where('id').equals(row.id)
            .filter(r => r._syncStatus === 'pending').count()
          if (pendingCount > 0) return
          await db.creditPayments.where('id').equals(row.id).delete()
          await db.creditPayments.put({ ...row, _syncStatus: 'synced' } as LocalCreditPayment)
        })
      }
    } catch (err) {
      console.error('[useReceivables] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getDetail = async (accountId: string): Promise<CreditAccountWithDetail | null> => {
    const account = await pickBestAccount(accountId)
    if (!account) return null

    const customer = await db.customers.where('id').equals(account.customer_id).first()
    const sale = await db.sales.where('id').equals(account.sale_id).first()
    const payments = await db.creditPayments
      .where('credit_account_id').equals(accountId)
      .toArray()

    // Deduplicar pagos
    const seen = new Map<string, (typeof payments)[number]>()
    for (const p of payments) {
      const prev = seen.get(p.id)
      if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seen.set(p.id, p)
    }
    const uniquePayments = Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const saleCode = sale
      ? `${sale.series}-${String(sale.number).padStart(4, '0')}`
      : '—'

    // Calcular paid_amount efectivo desde la suma real de pagos (guarda contra stale data)
    const realPaid = uniquePayments.reduce((s, p) => s + p.amount, 0)
    const effectivePaidAmount = Math.max(account.paid_amount, realPaid)

    return {
      ...account,
      paid_amount: effectivePaidAmount,
      customer_name: customer?.name ?? '—',
      sale_code: saleCode,
      balance: account.total_amount - effectivePaidAmount,
      payments: uniquePayments as CreditPayment[],
    }
  }

  const uploadVoucher = async (paymentId: string, file: File): Promise<string> => {
    const ext = file.name.split('.').pop()
    const path = `payments/${paymentId}.${ext}`
    const { error } = await supabase.storage
      .from('payment-vouchers')
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('payment-vouchers').getPublicUrl(path)
    return data.publicUrl
  }

  const registerPayment = async (params: {
    credit_account_id: string
    amount: number
    payment_method: PaymentMethod
    payment_date?: string
    reference: string
    notes: string
    voucher_url?: string | null
  }) => {
    if (!orgId || !user) throw new Error('Sin sesión activa')

    const account = await pickBestAccount(params.credit_account_id)
    if (!account) throw new Error('Cuenta no encontrada')

    if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0')

    // Calcular saldo REAL sumando los pagos existentes en Dexie (no confiar en paid_amount que puede estar stale)
    const existingPayments = await db.creditPayments
      .where('credit_account_id').equals(params.credit_account_id)
      .toArray()
    const seenPmts = new Map<string, typeof existingPayments[0]>()
    for (const p of existingPayments) {
      const prev = seenPmts.get(p.id)
      if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seenPmts.set(p.id, p)
    }
    const totalAlreadyPaid = Array.from(seenPmts.values()).reduce((s, p) => s + p.amount, 0)
    // Usar el mayor entre el campo almacenado y la suma real (el campo puede estar stale)
    const effectivePaid = Math.max(account.paid_amount, totalAlreadyPaid)
    const effectiveBalance = account.total_amount - effectivePaid

    if (effectiveBalance <= 0.001) {
      throw new Error('Esta cuenta ya está completamente pagada. Recarga la página para ver el estado actualizado.')
    }
    if (params.amount > effectiveBalance + 0.001) {
      throw new Error(`El monto supera el saldo real (${effectiveBalance.toFixed(2)}). Recarga la página.`)
    }

    const newPaidAmount = effectivePaid + params.amount

    const now = new Date().toISOString()
    const paymentCreatedAt = params.payment_date
      ? new Date(`${params.payment_date}T12:00:00`).toISOString()
      : now
    const newStatus = Math.round(newPaidAmount * 100) >= Math.round(account.total_amount * 100) ? 'paid' : 'active'

    // Crear pago
    const payment: CreditPayment = {
      id: generateUUID(),
      org_id: orgId,
      credit_account_id: params.credit_account_id,
      amount: params.amount,
      payment_method: params.payment_method,
      reference: params.reference || null,
      notes: params.notes || null,
      voucher_url: params.voucher_url ?? null,
      user_id: user.id,
      created_at: paymentCreatedAt,
      _syncStatus: 'pending',
    }
    await db.creditPayments.put(payment as LocalCreditPayment)

    // Actualizar cuenta
    await db.creditAccounts.where('id').equals(params.credit_account_id).modify({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_at: now,
      _syncStatus: 'pending',
    })

    // Sync
    await syncQueue.enqueue('credit_payments', 'INSERT', payment as unknown as Record<string, unknown>)
    const updatedAccount = await db.creditAccounts.where('id').equals(params.credit_account_id).first()
    if (updatedAccount) {
      await syncQueue.enqueue('credit_accounts', 'UPDATE', updatedAccount as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)

    const msg = newStatus === 'paid' ? 'Cuenta cancelada completamente' : `Pago de ${params.amount.toFixed(2)} registrado`
    toast.success(msg)
  }

  const removePayment = async (paymentId: string): Promise<void> => {
    if (!orgId) return
    if (!navigator.onLine) throw new Error('Se requiere conexión a internet para eliminar un cobro')

    const allRecords = await db.creditPayments.where('id').equals(paymentId).toArray()
    const payment = allRecords.sort((a, b) => (b._localId ?? 0) - (a._localId ?? 0))[0]

    if (payment?.voucher_url) {
      try {
        const marker = '/payment-vouchers/'
        const idx = payment.voucher_url.indexOf(marker)
        if (idx !== -1) {
          const filePath = payment.voucher_url.slice(idx + marker.length)
          await supabase.storage.from('payment-vouchers').remove([filePath])
        }
      } catch {
        // No bloquear si falla la eliminación del archivo
      }
    }

    const { error } = await supabase.from('credit_payments').delete().eq('id', paymentId)
    if (error) throw error

    await db.creditPayments.where('id').equals(paymentId).delete()

    if (payment?.credit_account_id) {
      const remaining = await db.creditPayments.where('credit_account_id').equals(payment.credit_account_id).toArray()
      const seenPmts = new Map<string, (typeof remaining)[number]>()
      for (const p of remaining) {
        const prev = seenPmts.get(p.id)
        if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seenPmts.set(p.id, p)
      }
      const newPaidAmount = Array.from(seenPmts.values()).reduce((s, p) => s + p.amount, 0)

      const account = await db.creditAccounts.where('id').equals(payment.credit_account_id).first()
      if (account) {
        await db.creditAccounts.where('id').equals(payment.credit_account_id).modify({
          paid_amount: newPaidAmount,
          status: newPaidAmount >= account.total_amount ? 'paid' : 'active',
          updated_at: new Date().toISOString(),
        })
      }
    }

    toast.success('Cobro eliminado')
  }

  const fixPaidStatuses = async () => {
    if (!orgId) return
    const all = await db.creditAccounts.where('org_id').equals(orgId).toArray()
    for (const a of all) {
      if (a.status !== 'paid' && Math.round(a.paid_amount * 100) >= Math.round(a.total_amount * 100)) {
        await db.creditAccounts.where('id').equals(a.id).modify({
          status: 'paid',
          _syncStatus: 'pending',
        })
        const updated = await db.creditAccounts.where('id').equals(a.id).first()
        if (updated) {
          await syncQueue.enqueue('credit_accounts', 'UPDATE', updated as unknown as Record<string, unknown>)
        }
      }
    }
    if (navigator.onLine) syncEngine.flush(orgId)
  }

  const updateOverdueStatuses = async () => {
    if (!orgId) return
    const today = new Date().toISOString().split('T')[0]
    const active = await db.creditAccounts
      .where('org_id').equals(orgId)
      .filter(a => a.status === 'active' && !!a.due_date && a.due_date < today)
      .toArray()

    for (const account of active) {
      await db.creditAccounts.where('id').equals(account.id).modify({
        status: 'overdue',
        _syncStatus: 'pending',
      })
      const updated = await db.creditAccounts.where('id').equals(account.id).first()
      if (updated) {
        await syncQueue.enqueue('credit_accounts', 'UPDATE', updated as unknown as Record<string, unknown>)
      }
    }
    if (active.length > 0 && navigator.onLine) syncEngine.flush(orgId)
  }

  return { accounts, paymentHistory, loading, load, getDetail, registerPayment, uploadVoucher, removePayment, updateOverdueStatuses, fixPaidStatuses }
}
