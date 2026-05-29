import { useLiveQuery } from 'dexie-react-hooks'
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { db, upsertById } from '@/core/db/dexie'
import { supabase } from '@/core/supabase/client'
import { syncQueue } from '@/core/sync/SyncQueue'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuth } from '@/core/auth/useAuth'
import { generateUUID } from '@/shared/utils/uuid'
import type { Product, CreateProductDto } from '../types'

export function useProducts() {
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)

  const products = useLiveQuery(
    () => orgId
      ? db.products
          .where('org_id').equals(orgId)
          .filter(p => !p.deleted_at)
          .toArray()
          .then(rows => {
            const seen = new Map<string, (typeof rows)[number]>()
            for (const row of rows) {
              const prev = seen.get(row.id)
              if (!prev || (row._localId ?? 0) > (prev._localId ?? 0)) seen.set(row.id, row)
            }
            return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
          })
      : [],
    [orgId],
    []
  ) as Product[]

  const load = async () => {
    if (!orgId || loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('org_id', orgId)
        .is('deleted_at', null)
      if (error) throw error
      if (data) {
        for (const row of data) {
          const hasPending = await db.products
            .where('id').equals(row.id)
            .filter(r => r._syncStatus === 'pending')
            .count()
          if (hasPending > 0) continue
          await upsertById(db.products, { ...row, _syncStatus: 'synced' })
        }
      }
    } catch (err) {
      console.error('[useProducts] load error:', err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const create = async (dto: CreateProductDto): Promise<Product> => {
    if (!orgId) throw new Error('Sin organización')
    const now = new Date().toISOString()
    const product: Product = {
      id: generateUUID(), org_id: orgId,
      ...dto,
      sku: dto.sku || null,
      barcode: dto.barcode || null,
      description: dto.description || null,
      category_id: dto.category_id || null,
      brand_id: dto.brand_id || null,
      unit_id: dto.unit_id || null,
      created_at: now, updated_at: now, deleted_at: null,
    }
    await db.products.put({ ...product, _syncStatus: 'pending' })
    await syncQueue.enqueue('products', 'INSERT', product as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Producto creado')
    return product
  }

  const update = async (id: string, dto: Partial<CreateProductDto>): Promise<void> => {
    if (!orgId) return
    const existing = await db.products.where('id').equals(id).first()
    if (!existing) return
    const updated: Product = {
      ...existing,
      ...dto,
      sku: dto.sku !== undefined ? (dto.sku || null) : existing.sku,
      barcode: dto.barcode !== undefined ? (dto.barcode || null) : existing.barcode,
      description: dto.description !== undefined ? (dto.description || null) : existing.description,
      category_id: dto.category_id !== undefined ? (dto.category_id || null) : existing.category_id,
      brand_id: dto.brand_id !== undefined ? (dto.brand_id || null) : existing.brand_id,
      unit_id: dto.unit_id !== undefined ? (dto.unit_id || null) : existing.unit_id,
      updated_at: new Date().toISOString(),
    }
    await db.products.put({ ...updated, _syncStatus: 'pending' })
    await syncQueue.enqueue('products', 'UPDATE', updated as unknown as Record<string, unknown>)
    if (navigator.onLine) syncEngine.flush(orgId)
    toast.success('Producto actualizado')
  }

  const remove = async (id: string): Promise<void> => {
    if (!orgId) return
    const now = new Date().toISOString()
    await db.products.where('id').equals(id).modify({ deleted_at: now, _syncStatus: 'pending' })
    const record = await db.products.where('id').equals(id).first()
    if (record) {
      await syncQueue.enqueue('products', 'UPDATE', record as unknown as Record<string, unknown>)
      if (navigator.onLine) syncEngine.flush(orgId)
    }
    toast.success('Producto eliminado')
  }

  const uploadImage = async (productId: string, file: File): Promise<string> => {
    const ext = file.name.split('.').pop()
    const path = `products/${productId}.${ext}`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    return data.publicUrl
  }

  return { products, loading, load, create, update, remove, uploadImage }
}
