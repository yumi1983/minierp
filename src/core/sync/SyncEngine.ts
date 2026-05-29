import { supabase } from '@/core/supabase/client'
import { db } from '@/core/db/dexie'
import { syncQueue } from './SyncQueue'
import { conflictResolver } from './ConflictResolver'

// Tablas que usan una columna distinta a 'id' como clave de conflicto en upsert
const UPSERT_CONFLICT_KEY: Record<string, string> = {
  company_settings: 'org_id',
}

// Orden de sincronización respetando dependencias FK
const TABLE_SYNC_PRIORITY: Record<string, number> = {
  categories: 0,
  brands: 0,
  units: 0,
  customers: 0,
  suppliers: 0,
  user_profiles: 0,
  company_settings: 0,
  products: 1,
  cash_registers: 1,
  purchase_orders: 2,
  sales: 2,
  cash_sessions: 3,
  purchase_order_items: 3,
  sale_items: 3,
  inventory_movements: 3,
  supplier_debts: 3,
  credit_accounts: 3,
  cash_movements: 4,
  supplier_payments: 4,
  credit_payments: 4,
}

// Columnas GENERATED ALWAYS AS en Postgres — no se pueden enviar en upsert
const GENERATED_COLUMNS: Record<string, string[]> = {
  supplier_debts: ['balance'],
  credit_accounts: ['balance'],
}

// Campos calculados por triggers en Supabase — la app los gestiona localmente
// pero NO los envía al servidor para evitar conflicto con el trigger
const SERVER_COMPUTED_FIELDS: Record<string, string[]> = {
  supplier_debts:    ['paid_amount', 'status'],
  credit_accounts:   ['paid_amount', 'status'],
  supplier_payments: ['status'],
  credit_payments:   ['status'],
}

const DEXIE_TABLE_MAP: Record<string, string> = {
  products: 'products',
  categories: 'categories',
  brands: 'brands',
  units: 'units',
  customers: 'customers',
  suppliers: 'suppliers',
  sales: 'sales',
  sale_items: 'saleItems',
  purchase_orders: 'purchaseOrders',
  purchase_order_items: 'purchaseOrderItems',
  inventory_movements: 'inventoryMovements',
  credit_accounts: 'creditAccounts',
  credit_payments: 'creditPayments',
  supplier_debts: 'supplierDebts',
  supplier_payments: 'supplierPayments',
  cash_registers: 'cashRegisters',
  cash_sessions: 'cashSessions',
  cash_movements: 'cashMovements',
  user_profiles: 'userProfiles',
  company_settings: 'companySettings',
}

export interface SyncEngineStatus {
  phase: 'idle' | 'pushing' | 'pulling' | 'error'
  pendingCount: number
}

const SYNC_LOCK_TTL = 15_000 // 15 segundos máximo por flush

class SyncEngine {
  private isSyncing = false
  private syncStartedAt = 0
  private listeners: Array<(status: SyncEngineStatus) => void> = []

  subscribe(fn: (status: SyncEngineStatus) => void) {
    this.listeners.push(fn)
    return () => { this.listeners = this.listeners.filter((l) => l !== fn) }
  }

  private emit(status: SyncEngineStatus) {
    this.listeners.forEach((l) => l(status))
  }

  forceUnlock() {
    this.isSyncing = false
  }

  async retryErrors(orgId: string): Promise<void> {
    await syncQueue.resetErrors()
    await this.flush(orgId)
  }

  private isLocked(): boolean {
    if (!this.isSyncing) return false
    // Auto-expirar el lock si lleva más de 15s (evita bloqueo permanente)
    if (Date.now() - this.syncStartedAt > SYNC_LOCK_TTL) {
      console.warn('[Sync] Lock expirado — forzando desbloqueo')
      this.isSyncing = false
      return false
    }
    return true
  }

  async flush(orgId: string): Promise<void> {
    if (this.isLocked()) {
      console.log('[Sync] Sync en curso, esperando...')
      return
    }

    const pending = await syncQueue.count()
    if (pending === 0) {
      console.log('[Sync] Cola vacía, nada que sincronizar')
      return
    }

    this.isSyncing = true
    this.syncStartedAt = Date.now()
    this.emit({ phase: 'pushing', pendingCount: pending })
    console.log(`[Sync] Iniciando flush con ${pending} operaciones pendientes`)

    try {
      await this.pushLocalChanges()
      await syncQueue.clearDone()
      const remaining = await syncQueue.count()
      this.emit({ phase: 'idle', pendingCount: remaining })
      console.log(`[Sync] Flush completo. Pendientes restantes: ${remaining}`)
    } catch (err) {
      console.error('[SyncEngine] Error general en flush:', err)
      this.emit({ phase: 'error', pendingCount: await syncQueue.count() })
    } finally {
      this.isSyncing = false
    }
  }

  private async pushLocalChanges(): Promise<void> {
    const raw = await syncQueue.getPending()
    const ops = [...raw].sort((a, b) => {
      const pa = TABLE_SYNC_PRIORITY[a.table_name] ?? 99
      const pb = TABLE_SYNC_PRIORITY[b.table_name] ?? 99
      if (pa !== pb) return pa - pb
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
    })
    console.log(`[Sync] Operaciones a procesar: ${ops.length}`)

    for (const op of ops) {
      await syncQueue.markProcessing(op.id)
      console.log(`[Sync] → ${op.operation} ${op.table_name} (${op.record_id})`)

      try {
        const payload = this.stripLocalFields(op.payload, op.table_name)

        if (op.operation === 'DELETE') {
          const { error } = await supabase
            .from(op.table_name)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', op.record_id)
          if (error) throw error
        } else {
          const conflictKey = UPSERT_CONFLICT_KEY[op.table_name] ?? 'id'
          const { error } = await supabase
            .from(op.table_name)
            .upsert(payload, { onConflict: conflictKey })

          if (error) {
            console.error(`[Sync] Error upsert ${op.table_name}:`, error.message, `(${error.code})`)
            throw error
          }
        }

        console.log(`[Sync] ✓ ${op.table_name} OK`)
        await syncQueue.markDone(op.id)
        await this.markSynced(op.table_name, op.record_id)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[Sync] ✗ ${op.table_name} FALLÓ:`, msg)
        await syncQueue.markError(op.id, msg)
      }
    }
  }

  async pullForTable(table: string, orgId: string): Promise<void> {
    const dexieTable = DEXIE_TABLE_MAP[table]
    if (!dexieTable) return

    const meta = await db.syncMeta.get(table)
    const since = meta?.last_synced_at ?? '1970-01-01T00:00:00Z'

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('org_id', orgId)
      .gt('updated_at', since)
      .limit(500)

    if (error) { console.warn(`[Sync] Pull ${table}:`, error.message); return }
    if (!data?.length) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = (db as any)[dexieTable]
    if (!tbl) return

    for (const record of data) {
      const existing = await tbl.where('id').equals(record.id).first()
      if (existing?._syncStatus === 'pending') continue
      if (existing) {
        // Actualizar en sitio (preserva _localId, evita duplicados)
        await tbl.where('id').equals(record.id).modify({ ...record, _syncStatus: 'synced' })
      } else {
        await tbl.put({ ...record, _syncStatus: 'synced' })
      }
    }

    await db.syncMeta.put({
      table_name: table,
      last_synced_at: new Date().toISOString(),
    })
  }

  private stripLocalFields(payload: Record<string, unknown>, tableName?: string): Record<string, unknown> {
    const clean = { ...payload }
    delete clean._localId
    delete clean._syncStatus
    delete clean._syncedAt
    Object.keys(clean).forEach((k) => { if (k.startsWith('_prev_')) delete clean[k] })
    // Eliminar columnas generadas (GENERATED ALWAYS AS) que Postgres rechaza en upsert
    if (tableName) {
      for (const col of GENERATED_COLUMNS[tableName] ?? []) {
        delete clean[col]
      }
      // Eliminar campos que maneja el trigger en Supabase para evitar doble escritura
      for (const col of SERVER_COMPUTED_FIELDS[tableName] ?? []) {
        delete clean[col]
      }
    }
    return clean
  }

  private async markSynced(tableName: string, recordId: string): Promise<void> {
    const dexieTable = DEXIE_TABLE_MAP[tableName]
    if (!dexieTable) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tbl = (db as any)[dexieTable]
    if (!tbl) return
    await tbl.where('id').equals(recordId).modify({ _syncStatus: 'synced' })
  }
}

export const syncEngine = new SyncEngine()
