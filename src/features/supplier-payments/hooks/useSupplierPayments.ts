import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { SupplierDebt, SupplierPayment, SupplierDebtWithDetail, SupplierPaymentHistoryEntry, PaymentMethod } from '../types'

export function useSupplierPayments() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const paymentHistory = useLiveQuery(
    async () => {
      if (!orgId) return []
      const all = await db.supplierPayments.where('org_id').equals(orgId).toArray()

      // Deduplicar
      const seen = new Map<string, (typeof all)[number]>()
      for (const p of all) {
        const prev = seen.get(p.id)
        if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seen.set(p.id, p)
      }

      // Enriquecer con deuda, proveedor y OC
      const entries = await Promise.all(
        Array.from(seen.values()).map(async p => {
          const debt = await db.supplierDebts.where('id').equals(p.debt_id).first()
          const supplier = debt
            ? await db.suppliers.where('id').equals(debt.supplier_id).first()
            : null
          const order = debt?.purchase_order_id
            ? await db.purchaseOrders.where('id').equals(debt.purchase_order_id).first()
            : null
          return {
            ...p,
            supplier_name: supplier?.name ?? '—',
            order_code: order
              ? `${order.series}-${String(order.number).padStart(4, '0')}`
              : '—',
          } as SupplierPaymentHistoryEntry
        })
      )

      return entries.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    },
    [orgId],
    []
  ) as SupplierPaymentHistoryEntry[]

  const debts = useLiveQuery(
    async () => {
      if (!orgId) return []
      const rows = await db.supplierDebts.where('org_id').equals(orgId).toArray()

      const seen = new Map<string, (typeof rows)[number]>()
      for (const row of rows) {
        const prev = seen.get(row.id)
        if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
      }

      // Excluir deudas cuya OC esté cancelada
      const result: (typeof rows)[number][] = []
      for (const debt of seen.values()) {
        if (debt.purchase_order_id) {
          const order = await db.purchaseOrders.where('id').equals(debt.purchase_order_id).first()
          if (order?.status === 'cancelled') continue
        }
        result.push(debt)
      }

      return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },
    [orgId],
    []
  ) as SupplierDebt[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data: debtsData, error: err1 } = await supabase
        .from('supplier_debts')
        .select('*')
        .eq('org_id', orgId)
      if (err1) throw err1
      for (const row of debtsData ?? []) {
        await upsertById(db.supplierDebts, { ...row, _syncStatus: 'synced' })
      }

      const { data: paymentsData, error: err2 } = await supabase
        .from('supplier_payments')
        .select('*')
        .eq('org_id', orgId)
      if (err2) throw err2
      for (const row of paymentsData ?? []) {
        await upsertById(db.supplierPayments, { ...row, _syncStatus: 'synced' })
      }
    } catch (err) {
      console.error('[useSupplierPayments] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getDetail = async (debtId: string): Promise<SupplierDebtWithDetail | null> => {
    const debt = await db.supplierDebts.where('id').equals(debtId).first()
    if (!debt) return null

    const supplier = await db.suppliers.where('id').equals(debt.supplier_id).first()
    const order = debt.purchase_order_id
      ? await db.purchaseOrders.where('id').equals(debt.purchase_order_id).first()
      : null

    const rawPayments = await db.supplierPayments.where('debt_id').equals(debtId).toArray()
    const seen = new Map<string, (typeof rawPayments)[number]>()
    for (const p of rawPayments) {
      const prev = seen.get(p.id)
      if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seen.set(p.id, p)
    }
    const payments = Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    const orderCode = order
      ? `${order.series}-${String(order.number).padStart(4, '0')}`
      : '—'

    return {
      ...debt,
      supplier_name: supplier?.name ?? '—',
      order_code: orderCode,
      balance: debt.total_amount - debt.paid_amount,
      payments: payments as SupplierPayment[],
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
    debt_id: string
    amount: number
    payment_method: PaymentMethod
    payment_date?: string
    reference: string
    notes: string
    voucher_url?: string | null
  }) => {
    if (!orgId || !user) throw new Error('Sin sesión activa')

    const debt = await db.supplierDebts.where('id').equals(params.debt_id).first()
    if (!debt) throw new Error('Deuda no encontrada')

    const balance = debt.total_amount - debt.paid_amount
    if (params.amount <= 0) throw new Error('El monto debe ser mayor a 0')
    if (params.amount > balance) throw new Error(`El monto supera el saldo pendiente (${balance.toFixed(2)})`)

    const now = new Date().toISOString()
    const paymentCreatedAt = params.payment_date
      ? new Date(`${params.payment_date}T12:00:00`).toISOString()
      : now
    const newPaidAmount = debt.paid_amount + params.amount
    const newStatus = newPaidAmount >= debt.total_amount ? 'paid' : 'active'

    const payment: SupplierPayment = {
      id: generateUUID(),
      org_id: orgId,
      supplier_id: debt.supplier_id,
      debt_id: params.debt_id,
      amount: params.amount,
      payment_method: params.payment_method,
      reference: params.reference || null,
      notes: params.notes || null,
      voucher_url: params.voucher_url ?? null,
      user_id: user.id,
      created_at: paymentCreatedAt,
      _syncStatus: 'pending',
    }
    await db.supplierPayments.put(payment as import('@/core/db/dexie').LocalSupplierPayment)

    await db.supplierDebts.where('id').equals(params.debt_id).modify({
      paid_amount: newPaidAmount,
      status: newStatus,
      updated_at: now,
      _syncStatus: 'pending',
    })

    await syncQueue.enqueue('supplier_payments', 'INSERT', payment as unknown as Record<string, unknown>)
    const updatedDebt = await db.supplierDebts.where('id').equals(params.debt_id).first()
    if (updatedDebt) {
      await syncQueue.enqueue('supplier_debts', 'UPDATE', updatedDebt as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)

    const msg = newStatus === 'paid' ? 'Deuda cancelada completamente' : `Pago de ${params.amount.toFixed(2)} registrado`
    toast.success(msg)
  }

  const removePayment = async (paymentId: string): Promise<void> => {
    if (!orgId) return
    if (!navigator.onLine) throw new Error('Se requiere conexión a internet para eliminar un pago')

    // Obtener el pago antes de borrar (necesitamos debt_id y voucher_url)
    const allRecords = await db.supplierPayments.where('id').equals(paymentId).toArray()
    const payment = allRecords.sort((a, b) => (b._localId ?? 0) - (a._localId ?? 0))[0]

    // 1. Eliminar voucher del Storage de Supabase
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

    // 2. Eliminar físicamente de Supabase
    const { error } = await supabase.from('supplier_payments').delete().eq('id', paymentId)
    if (error) throw error

    // 3. Eliminar de Dexie (todos los registros con ese id, pueden ser duplicados)
    await db.supplierPayments.where('id').equals(paymentId).delete()

    // 4. Recomputar paid_amount local desde los pagos restantes
    //    (el trigger de Supabase ya actualizó el servidor)
    if (payment?.debt_id) {
      const remaining = await db.supplierPayments.where('debt_id').equals(payment.debt_id).toArray()
      const seenPmts = new Map<string, (typeof remaining)[number]>()
      for (const p of remaining) {
        const prev = seenPmts.get(p.id)
        if (!prev || (p._localId ?? 0) > (prev._localId ?? 0)) seenPmts.set(p.id, p)
      }
      const newPaidAmount = Array.from(seenPmts.values()).reduce((s, p) => s + p.amount, 0)

      const debt = await db.supplierDebts.where('id').equals(payment.debt_id).first()
      if (debt) {
        await db.supplierDebts.where('id').equals(payment.debt_id).modify({
          paid_amount: newPaidAmount,
          status: newPaidAmount >= debt.total_amount ? 'paid' : 'active',
          updated_at: new Date().toISOString(),
        })
      }
    }

    toast.success('Pago eliminado')
  }

  const updateOverdueStatuses = async () => {
    if (!orgId) return
    const today = new Date().toISOString().split('T')[0]
    const active = await db.supplierDebts
      .where('org_id').equals(orgId)
      .filter(d => d.status === 'active' && !!d.due_date && d.due_date < today)
      .toArray()

    for (const debt of active) {
      await db.supplierDebts.where('id').equals(debt.id).modify({
        status: 'overdue',
        _syncStatus: 'pending',
      })
      const updated = await db.supplierDebts.where('id').equals(debt.id).first()
      if (updated) {
        await syncQueue.enqueue('supplier_debts', 'UPDATE', updated as unknown as Record<string, unknown>)
      }
    }
    if (active.length > 0 && navigator.onLine) syncEngine.flush(orgId)
  }

  return { debts, paymentHistory, loading, load, getDetail, registerPayment, uploadVoucher, removePayment, updateOverdueStatuses }
}
