import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { LocalInventoryMovement } from '@/core/db/dexie'

export type MovementType = 'IN' | 'OUT' | 'ADJ'

export interface InventoryMovement extends LocalInventoryMovement {
  _localId?: number
}

export function useInventory() {
  const { orgId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const movements = useLiveQuery(
    () => orgId
      ? db.inventoryMovements
          .where('org_id').equals(orgId)
          .toArray()
          .then(rows => {
            const seen = new Map<string, InventoryMovement>()
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
  ) as InventoryMovement[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      for (const row of data ?? []) {
        await upsertById(db.inventoryMovements, row)
      }
    } catch (err) {
      console.error('[useInventory] load:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const getByProduct = async (productId: string): Promise<InventoryMovement[]> => {
    const rows = await db.inventoryMovements
      .where('product_id').equals(productId)
      .toArray()
    const seen = new Map<string, InventoryMovement>()
    for (const row of rows) {
      const prev = seen.get(row.id)
      if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
    }
    return Array.from(seen.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  const adjust = async (params: {
    product_id: string
    type: MovementType
    quantity: number
    notes: string
  }) => {
    if (!orgId || !user) throw new Error('Sin sesión activa')
    if (params.quantity <= 0) throw new Error('La cantidad debe ser mayor a 0')

    const product = await db.products.where('id').equals(params.product_id).first()
    if (!product) throw new Error('Producto no encontrado')

    const now = new Date().toISOString()
    let stockAfter: number
    let quantity = params.quantity

    switch (params.type) {
      case 'IN':
        stockAfter = product.stock + params.quantity
        break
      case 'OUT':
        if (params.quantity > product.stock) throw new Error(`Stock insuficiente (disponible: ${product.stock})`)
        stockAfter = product.stock - params.quantity
        break
      case 'ADJ':
        // Para ajuste, quantity ES el nuevo stock absoluto
        stockAfter = params.quantity
        quantity = Math.abs(params.quantity - product.stock)
        break
    }

    const movement: InventoryMovement = {
      id: generateUUID(),
      org_id: orgId,
      product_id: params.product_id,
      type: params.type,
      quantity,
      stock_before: product.stock,
      stock_after: stockAfter,
      unit_cost: product.purchase_price,
      reference_type: 'adjustment',
      reference_id: null,
      notes: params.notes || null,
      user_id: user.id,
      created_at: now,
    }

    await db.products.where('id').equals(params.product_id).modify({
      stock: stockAfter,
      updated_at: now,
      _syncStatus: 'pending',
    })
    await db.inventoryMovements.put(movement)

    await syncQueue.enqueue('inventory_movements', 'INSERT', movement as unknown as Record<string, unknown>)
    const updatedProduct = await db.products.where('id').equals(params.product_id).first()
    if (updatedProduct) {
      await syncQueue.enqueue('products', 'UPDATE', updatedProduct as unknown as Record<string, unknown>)
    }
    if (navigator.onLine) syncEngine.flush(orgId)

    const typeLabel = params.type === 'IN' ? 'Entrada' : params.type === 'OUT' ? 'Salida' : 'Ajuste'
    toast.success(`${typeLabel} registrada correctamente`)
  }

  return { movements, loading, load, getByProduct, adjust }
}
