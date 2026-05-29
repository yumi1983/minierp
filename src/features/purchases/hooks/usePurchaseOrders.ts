import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { useCompanyStore } from '@/features/company/store/company.store'
import { generateUUID } from '@/shared/utils/uuid'
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderWithItems, ReceptionData } from '../types'

export function usePurchaseOrders() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const companySettings = useCompanyStore(s => s.settings)

  const orders = useLiveQuery(
    () => orgId
      ? db.purchaseOrders
          .where('org_id').equals(orgId)
          .filter(o => !o.deleted_at)
          .toArray()
          .then(rows => {
            const seen = new Map<string, (typeof rows)[number]>()
            for (const row of rows) {
              const prev = seen.get(row.id)
              if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
            }
            return Array.from(seen.values()).sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          })
      : [],
    [orgId],
    []
  ) as PurchaseOrder[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
      if (ordersError) throw ordersError

      const { data: itemsData, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('*')
        .in('purchase_order_id', (ordersData ?? []).map(o => o.id))
      if (itemsError) throw itemsError

      for (const row of ordersData ?? []) {
        await upsertById(db.purchaseOrders, { ...row, _syncStatus: 'synced' })
      }
      for (const row of itemsData ?? []) {
        await upsertById(db.purchaseOrderItems, row)
      }
    } catch (err) {
      console.error('[usePurchaseOrders] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getWithItems = async (orderId: string): Promise<PurchaseOrderWithItems | null> => {
    const order = await db.purchaseOrders.where('id').equals(orderId).first()
    if (!order) return null
    const items = await db.purchaseOrderItems.where('purchase_order_id').equals(orderId).toArray()
    return { ...order, items }
  }

  const getNextNumber = async (): Promise<number> => {
    const last = await db.purchaseOrders
      .where('org_id').equals(orgId ?? '')
      .toArray()
      .then(rows => rows.reduce((max, o) => Math.max(max, o.number), 0))
    return last + 1
  }

  const create = async (dto: {
    supplier_id: string
    issue_date: string | null
    expected_date: string | null
    notes: string | null
    tax_rate: number
    items: Array<{ product_id: string; quantity: number; unit_price: number }>
  }): Promise<PurchaseOrder> => {
    if (!orgId || !user) throw new Error('Sin sesión activa')

    const now = new Date().toISOString()
    const series = companySettings?.po_series ?? 'OC001'
    const number = await getNextNumber()

    const subtotal = dto.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const tax_amount = subtotal * (dto.tax_rate / 100)
    const total = subtotal + tax_amount

    const order: PurchaseOrder = {
      id: generateUUID(),
      org_id: orgId,
      supplier_id: dto.supplier_id,
      series,
      number,
      status: 'draft',
      subtotal,
      tax_amount,
      total,
      notes: dto.notes,
      reception_notes: null,
      freight_cost: null,
      received_total: null,
      issue_date: dto.issue_date,
      expected_date: dto.expected_date,
      user_id: user.id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    const items: PurchaseOrderItem[] = dto.items.map(i => ({
      id: generateUUID(),
      purchase_order_id: order.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.quantity * i.unit_price,
      received_quantity: 0,
      rejected_quantity: 0,
    }))

    await db.purchaseOrders.put({ ...order, _syncStatus: 'pending' })
    for (const item of items) await db.purchaseOrderItems.put(item)

    await syncQueue.enqueue('purchase_orders', 'INSERT', order as unknown as Record<string, unknown>)
    for (const item of items) {
      await syncQueue.enqueue('purchase_order_items', 'INSERT', item as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)

    toast.success('Orden de compra creada')
    return order
  }

  const update = async (
    id: string,
    dto: {
      supplier_id: string
      issue_date: string | null
      expected_date: string | null
      notes: string | null
      tax_rate: number
      items: Array<{ id?: string; product_id: string; quantity: number; unit_price: number }>
    }
  ): Promise<void> => {
    if (!orgId) return
    const now = new Date().toISOString()

    const subtotal = dto.items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const tax_amount = subtotal * (dto.tax_rate / 100)
    const total = subtotal + tax_amount

    const existing = await db.purchaseOrders.where('id').equals(id).first()
    if (!existing) return

    const updated = {
      ...existing,
      supplier_id: dto.supplier_id,
      issue_date: dto.issue_date,
      expected_date: dto.expected_date,
      notes: dto.notes,
      subtotal,
      tax_amount,
      total,
      updated_at: now,
    }

    await db.purchaseOrders.where('id').equals(id).modify({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('purchase_orders', 'UPDATE', updated as unknown as Record<string, unknown>)

    // Actualizar ítems: eliminar los anteriores e insertar los nuevos
    await db.purchaseOrderItems.where('purchase_order_id').equals(id).delete()

    const newItems: PurchaseOrderItem[] = dto.items.map(i => ({
      id: i.id ?? generateUUID(),
      purchase_order_id: id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      subtotal: i.quantity * i.unit_price,
      received_quantity: 0,
      rejected_quantity: 0,
    }))

    for (const item of newItems) {
      await db.purchaseOrderItems.put(item)
      await syncQueue.enqueue('purchase_order_items', 'INSERT', item as unknown as Record<string, unknown>)
    }

    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Orden actualizada')
  }

  const updateStatus = async (id: string, status: PurchaseOrder['status']): Promise<void> => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.purchaseOrders.where('id').equals(id).modify({ status, updated_at: now, _syncStatus: 'pending' })
    const record = await db.purchaseOrders.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('purchase_orders', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
  }

  const receive = async (orderId: string, receptionData: ReceptionData): Promise<void> => {
    if (!orgId || !user) throw new Error('Sin sesión activa')

    // Usar el registro más actualizado de la orden (pending > synced, luego _localId más alto)
    const orderRecords = await db.purchaseOrders.where('id').equals(orderId).toArray()
    if (orderRecords.length === 0) throw new Error('Orden no encontrada')
    const order = orderRecords.sort((a, b) => {
      const ap = a._syncStatus === 'pending' ? 1 : 0
      const bp = b._syncStatus === 'pending' ? 1 : 0
      if (ap !== bp) return bp - ap
      return (b._localId ?? 0) - (a._localId ?? 0)
    })[0]
    if (order.status === 'received') throw new Error('Ya fue recepcionada')

    // Deduplicar ítems por id para evitar doble procesamiento
    const allItems = await db.purchaseOrderItems.where('purchase_order_id').equals(orderId).toArray()
    const itemsSeen = new Map<string, (typeof allItems)[number]>()
    for (const row of allItems) {
      const prev = itemsSeen.get(row.id)
      if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) itemsSeen.set(row.id, row)
    }
    const items = Array.from(itemsSeen.values())

    const now = new Date().toISOString()
    const orderCode = `${order.series}-${String(order.number).padStart(4, '0')}`

    // Mapa de cantidades por ítem
    const receptionMap = Object.fromEntries(
      receptionData.items.map(r => [r.item_id, r])
    )

    // 1. Crear movimientos de inventario solo por cantidades recibidas
    for (const item of items) {
      const reception = receptionMap[item.id]
      const receivedQty = reception?.received_qty ?? 0
      const rejectedQty = reception?.rejected_qty ?? 0

      // Actualizar received_quantity y rejected_quantity en el ítem
      await db.purchaseOrderItems.where('id').equals(item.id).modify({
        received_quantity: receivedQty,
        rejected_quantity: rejectedQty,
      })
      const updatedItem = await db.purchaseOrderItems.where('id').equals(item.id).first()
      if (updatedItem) {
        await syncQueue.enqueue('purchase_order_items', 'UPDATE', updatedItem as unknown as Record<string, unknown>)
      }

      if (receivedQty <= 0) continue

      // Usar el registro de producto más actualizado
      const productRecords = await db.products.where('id').equals(item.product_id).toArray()
      if (productRecords.length === 0) {
        console.warn('[receive] producto no encontrado en Dexie:', item.product_id)
        continue
      }
      const product = productRecords.sort((a, b) => {
        const ap = a._syncStatus === 'pending' ? 1 : 0
        const bp = b._syncStatus === 'pending' ? 1 : 0
        if (ap !== bp) return bp - ap
        return (b._localId ?? 0) - (a._localId ?? 0)
      })[0]

      const stockBefore = product.stock
      const stockAfter = stockBefore + receivedQty

      console.log('[receive] cálculo stock:', {
        producto: product.name,
        product_id: item.product_id,
        registros_dexie: productRecords.length,
        todos_stocks: productRecords.map(r => ({ _localId: r._localId, stock: r.stock, _syncStatus: r._syncStatus })),
        stock_seleccionado: product.stock,
        receivedQty,
        stockBefore,
        stockAfter,
      })

      const movementNotes = rejectedQty > 0
        ? `Recepción OC ${orderCode} — recibido: ${receivedQty}, rechazado: ${rejectedQty}`
        : `Recepción OC ${orderCode}`

      const movement = {
        id: generateUUID(),
        org_id: orgId,
        product_id: item.product_id,
        type: 'IN' as const,
        quantity: receivedQty,
        stock_before: stockBefore,
        stock_after: stockAfter,
        unit_cost: item.unit_price,
        reference_type: 'purchase',
        reference_id: orderId,
        notes: movementNotes,
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

    // 2. Calcular deuda sólo sobre lo recibido (el flete es gasto propio, no deuda al proveedor)
    const receivedSubtotal = receptionData.items.reduce((sum, r) => {
      const item = items.find(i => i.id === r.item_id)
      return sum + (item ? r.received_qty * item.unit_price : 0)
    }, 0)
    const taxFactor = order.subtotal > 0 ? order.tax_amount / order.subtotal : 0
    const debtAmount = receivedSubtotal * (1 + taxFactor)

    if (debtAmount > 0) {
      const debt = {
        id: generateUUID(),
        org_id: orgId,
        supplier_id: order.supplier_id,
        purchase_order_id: orderId,
        total_amount: debtAmount,
        paid_amount: 0,
        due_date: null,
        status: 'active' as const,
        created_at: now,
        updated_at: now,
      }
      await db.supplierDebts.put({ ...debt, _syncStatus: 'pending' })
      await syncQueue.enqueue('supplier_debts', 'INSERT', debt as unknown as Record<string, unknown>)
    }

    // 3. Guardar received_total, flete y observaciones en la OC
    await db.purchaseOrders.where('id').equals(orderId).modify({
      received_total: debtAmount,
      reception_notes: receptionData.notes || null,
      freight_cost: (receptionData.freight_cost ?? 0) > 0 ? receptionData.freight_cost : null,
      updated_at: now,
      _syncStatus: 'pending',
    })
    const updatedOrder = await db.purchaseOrders.where('id').equals(orderId).first()
    if (updatedOrder) {
      await syncQueue.enqueue('purchase_orders', 'UPDATE', updatedOrder as unknown as Record<string, unknown>)
    }

    // 4. Cambiar estado de OC a 'received'
    await updateStatus(orderId, 'received')
    if (navigator.onLine) syncEngine.flush(orgId)

    const receivedCount = receptionData.items.filter(r => r.received_qty > 0).length
    const rejectedCount = receptionData.items.filter(r => r.rejected_qty > 0).length
    let msg = 'Recepción registrada'
    if (rejectedCount > 0) msg += ` — ${rejectedCount} producto${rejectedCount > 1 ? 's' : ''} rechazado${rejectedCount > 1 ? 's' : ''}`
    toast.success(msg)
  }

  const remove = async (id: string): Promise<void> => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.purchaseOrders.where('id').equals(id).modify({ deleted_at: now, _syncStatus: 'pending' })
    const record = await db.purchaseOrders.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('purchase_orders', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Orden eliminada')
  }

  return { orders, loading, load, create, update, getWithItems, updateStatus, receive, remove }
}
