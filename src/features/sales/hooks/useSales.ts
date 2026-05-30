import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import type { LocalCreditPayment } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { useCompanyStore } from '@/features/company/store/company.store'
import { generateUUID } from '@/shared/utils/uuid'
import type { Sale, SaleItem, SaleWithItems, SaleType, PaymentMethod } from '../types'
import type { CartItem } from '../types'

export function useSales() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const companySettings = useCompanyStore(s => s.settings)

  const sales = useLiveQuery(
    () => orgId
      ? db.sales
          .where('org_id').equals(orgId)
          .filter(s => !s.deleted_at)
          .toArray()
          .then(rows => {
            const seen = new Map<string, (typeof rows)[number]>()
            for (const row of rows) {
              const prev = seen.get(row.id)
              if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
            }
            return Array.from(seen.values()).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          })
      : [],
    [orgId],
    []
  ) as Sale[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      for (const row of data ?? []) {
        await upsertById(db.sales, { ...row, _syncStatus: 'synced' })
      }
    } catch (err) {
      console.error('[useSales] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getNextNumber = async (series: string): Promise<number> => {
    if (navigator.onLine) {
      const { data, error } = await supabase.rpc('get_next_number', {
        p_org_id: orgId,
        p_series: series,
        p_kind: 'sale',
      })
      if (!error && typeof data === 'number') return data
    }
    // Fallback offline: máximo local + 1
    const rows = await db.sales.where('org_id').equals(orgId ?? '').toArray()
    return rows.reduce((max, s) => Math.max(max, s.number), 0) + 1
  }

  const confirm = async (params: {
    items: CartItem[]
    customer_id: string | null
    type: SaleType
    payment_method: PaymentMethod
    globalDiscount: number
    freightCost: number
    notes: string
    taxRate: number
    saleDate: string
    cashSessionId: string | null
    advanceAmount: number
    advanceMethod: PaymentMethod
    advanceCashSessionId: string | null
  }): Promise<SaleWithItems> => {
    if (!orgId || !user) throw new Error('Sin sesión activa')
    if (params.items.length === 0) throw new Error('El carrito está vacío')
    if (params.type === 'credit' && !params.customer_id) {
      throw new Error('Las ventas a crédito requieren un cliente')
    }

    const now = new Date().toISOString()
    const saleCreatedAt = params.saleDate
      ? new Date(`${params.saleDate}T12:00:00`).toISOString()
      : now
    const series = companySettings?.receipt_series ?? 'NP001'
    const number = await getNextNumber(series)

    // Calcular totales
    const itemsSubtotal = params.items.reduce((s, i) => s + i.subtotal, 0)
    const discountAmount = itemsSubtotal * (params.globalDiscount / 100)
    const subtotal = itemsSubtotal - discountAmount
    const taxAmount = subtotal * (params.taxRate / 100)
    const total = subtotal + taxAmount

    const sale: Sale = {
      id: generateUUID(),
      org_id: orgId,
      customer_id: params.customer_id,
      series,
      number,
      type: params.type,
      status: 'confirmed',
      subtotal,
      discount: discountAmount,
      tax_rate: params.taxRate,
      tax_amount: taxAmount,
      total,
      payment_method: params.type === 'cash' ? params.payment_method : null,
      cash_session_id: params.type === 'cash' ? (params.cashSessionId ?? null) : null,
      freight_cost: params.freightCost > 0 ? params.freightCost : null,
      notes: params.notes || null,
      user_id: user.id,
      created_at: saleCreatedAt,
      updated_at: now,
      deleted_at: null,
    }

    const saleItems: SaleItem[] = params.items.map(i => ({
      id: generateUUID(),
      sale_id: sale.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
      subtotal: i.subtotal,
    }))

    // 1. Guardar venta e ítems localmente
    await db.sales.put({ ...sale, _syncStatus: 'pending' })
    for (const item of saleItems) await db.saleItems.put(item)

    // 2. Actualizar stock (OUT) por cada ítem
    for (const item of params.items) {
      const product = await db.products.where('id').equals(item.product_id).first()
      if (!product) continue
      const stockAfter = product.stock - item.quantity
      const movement = {
        id: generateUUID(),
        org_id: orgId,
        product_id: item.product_id,
        type: 'OUT' as const,
        quantity: item.quantity,
        stock_before: product.stock,
        stock_after: stockAfter,
        unit_cost: product.purchase_price,
        reference_type: 'sale',
        reference_id: sale.id,
        notes: `Venta ${series}-${String(number).padStart(4, '0')}`,
        user_id: user.id,
        created_at: saleCreatedAt,
      }
      await db.products.where('id').equals(item.product_id).modify({
        stock: stockAfter,
        updated_at: now,
        _syncStatus: 'pending',
      })
      await db.inventoryMovements.put(movement)
      await syncQueue.enqueue('inventory_movements', 'INSERT', movement as unknown as Record<string, unknown>)
      const updatedProduct = await db.products.where('id').equals(item.product_id).first()
      if (updatedProduct) {
        await syncQueue.enqueue('products', 'UPDATE', updatedProduct as unknown as Record<string, unknown>)
      }
    }

    // 3. Crear cuenta por cobrar si es crédito
    if (params.type === 'credit' && params.customer_id) {
      const advance = params.advanceAmount > 0 ? Math.min(params.advanceAmount, total) : 0
      const creditAccountId = generateUUID()
      const creditAccount = {
        id: creditAccountId,
        org_id: orgId,
        sale_id: sale.id,
        customer_id: params.customer_id,
        total_amount: total,
        paid_amount: advance,
        due_date: null,
        status: (advance >= total ? 'paid' : 'active') as 'paid' | 'active',
        created_at: saleCreatedAt,
        updated_at: now,
      }
      await db.creditAccounts.put({ ...creditAccount, _syncStatus: 'pending' })
      await syncQueue.enqueue('credit_accounts', 'INSERT', creditAccount as unknown as Record<string, unknown>)

      // Adelanto: crear cobro parcial con la fecha de la venta
      if (advance > 0) {
        const creditPayment: LocalCreditPayment = {
          id: generateUUID(),
          org_id: orgId,
          credit_account_id: creditAccountId,
          amount: advance,
          payment_method: params.advanceMethod,
          reference: null,
          notes: 'Adelanto al momento de la venta',
          voucher_url: null,
          user_id: user.id,
          created_at: saleCreatedAt,
          _syncStatus: 'pending',
        }
        await db.creditPayments.put(creditPayment)
        await syncQueue.enqueue('credit_payments', 'INSERT', creditPayment as unknown as Record<string, unknown>)

        // Movimiento de caja si el adelanto es en efectivo y hay sesión abierta
        if (params.advanceMethod === 'cash' && params.advanceCashSessionId) {
          const cashMov = {
            id: generateUUID(),
            org_id: orgId,
            session_id: params.advanceCashSessionId,
            type: 'income' as const,
            amount: advance,
            description: `Adelanto venta ${series}-${String(number).padStart(4, '0')}`,
            reference_type: 'sale',
            reference_id: sale.id,
            user_id: user.id,
            created_at: saleCreatedAt,
            _syncStatus: 'pending' as const,
          }
          await db.cashMovements.put(cashMov)
          await syncQueue.enqueue('cash_movements', 'INSERT', cashMov as unknown as Record<string, unknown>)
        }
      }
    }

    // 4. Movimiento de caja si hay sesión abierta y es venta al contado
    if (params.type === 'cash' && params.cashSessionId) {
      const movement = {
        id: generateUUID(),
        org_id: orgId,
        session_id: params.cashSessionId,
        type: 'income' as const,
        amount: total,
        description: `Venta ${series}-${String(number).padStart(4, '0')}`,
        reference_type: 'sale',
        reference_id: sale.id,
        user_id: user.id,
        created_at: saleCreatedAt,
        _syncStatus: 'pending' as const,
      }
      await db.cashMovements.put(movement)
      await syncQueue.enqueue('cash_movements', 'INSERT', movement as unknown as Record<string, unknown>)
    }

    // 5. Encolar sync
    await syncQueue.enqueue('sales', 'INSERT', sale as unknown as Record<string, unknown>)
    for (const item of saleItems) {
      await syncQueue.enqueue('sale_items', 'INSERT', item as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)

    toast.success(`Venta ${series}-${String(number).padStart(4, '0')} registrada`)
    return { ...sale, items: saleItems }
  }

  const cancel = async (id: string): Promise<void> => {
    if (!orgId || !user) return
    const now = new Date().toISOString()

    const sale = await db.sales.where('id').equals(id).first()
    if (!sale || sale.status !== 'confirmed') return

    // Revertir stock por cada ítem
    const items = await db.saleItems.where('sale_id').equals(id).toArray()
    for (const item of items) {
      const product = await db.products.where('id').equals(item.product_id).first()
      if (!product) continue
      const stockAfter = product.stock + item.quantity
      const movement = {
        id: generateUUID(),
        org_id: orgId,
        product_id: item.product_id,
        type: 'IN' as const,
        quantity: item.quantity,
        stock_before: product.stock,
        stock_after: stockAfter,
        unit_cost: product.purchase_price,
        reference_type: 'sale_cancel',
        reference_id: id,
        notes: `Cancelación venta ${sale.series}-${String(sale.number).padStart(4, '0')}`,
        user_id: user.id,
        created_at: now,
      }
      await db.products.where('id').equals(item.product_id).modify({
        stock: stockAfter,
        updated_at: now,
        _syncStatus: 'pending',
      })
      await db.inventoryMovements.put(movement)
      await syncQueue.enqueue('inventory_movements', 'INSERT', movement as unknown as Record<string, unknown>)
      const updatedProduct = await db.products.where('id').equals(item.product_id).first()
      if (updatedProduct) {
        await syncQueue.enqueue('products', 'UPDATE', updatedProduct as unknown as Record<string, unknown>)
      }
    }

    // Marcar venta como cancelada
    await db.sales.where('id').equals(id).modify({ status: 'cancelled', updated_at: now, _syncStatus: 'pending' })
    const record = await db.sales.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('sales', 'UPDATE', record as unknown as Record<string, unknown>)
    }

    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Venta cancelada y stock revertido')
  }

  const getWithItems = async (saleId: string): Promise<SaleWithItems | null> => {
    const sale = await db.sales.where('id').equals(saleId).first()
    if (!sale) return null
    const items = await db.saleItems.where('sale_id').equals(saleId).toArray()
    let customer_name: string | undefined
    if (sale.customer_id) {
      const customer = await db.customers.where('id').equals(sale.customer_id).first()
      customer_name = customer?.name
    }
    return { ...sale, items, customer_name } as unknown as SaleWithItems
  }

  return { sales, loading, load, confirm, cancel, getWithItems }
}
