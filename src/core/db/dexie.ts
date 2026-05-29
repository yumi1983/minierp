import Dexie, { Table } from 'dexie'
import type { SyncOperation, SyncMeta } from '@/core/sync/types'

export interface LocalProduct {
  _localId?: number
  id: string
  org_id: string
  sku: string | null
  barcode: string | null
  name: string
  description: string | null
  category_id: string | null
  brand_id: string | null
  unit_id: string | null
  purchase_price: number
  sale_price: number
  stock: number
  min_stock: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCategory {
  _localId?: number
  id: string
  org_id: string
  name: string
  description: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalBrand {
  _localId?: number
  id: string
  org_id: string
  name: string
  created_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalUnit {
  _localId?: number
  id: string
  org_id: string
  name: string
  abbreviation: string
  created_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCustomer {
  _localId?: number
  id: string
  org_id: string
  name: string
  tax_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalSupplier {
  _localId?: number
  id: string
  org_id: string
  name: string
  tax_id: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalSale {
  _localId?: number
  id: string
  org_id: string
  customer_id: string | null
  series: string
  number: number
  type: 'cash' | 'credit'
  status: 'draft' | 'confirmed' | 'cancelled'
  subtotal: number
  discount: number
  tax_rate: number
  tax_amount: number
  total: number
  payment_method: string | null
  cash_session_id: string | null
  freight_cost: number | null
  notes: string | null
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalSaleItem {
  _localId?: number
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

export interface LocalPurchaseOrder {
  _localId?: number
  id: string
  org_id: string
  supplier_id: string
  series: string
  number: number
  status: 'draft' | 'sent' | 'received' | 'cancelled'
  subtotal: number
  tax_amount: number
  total: number
  notes: string | null
  reception_notes: string | null
  freight_cost: number | null
  received_total: number | null
  issue_date: string | null
  expected_date: string | null
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalPurchaseOrderItem {
  _localId?: number
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  received_quantity: number
  rejected_quantity: number
}

export interface LocalInventoryMovement {
  _localId?: number
  id: string
  org_id: string
  product_id: string
  type: 'IN' | 'OUT' | 'ADJ' | 'TRANSFER'
  quantity: number
  stock_before: number
  stock_after: number
  unit_cost: number | null
  reference_type: string | null
  reference_id: string | null
  notes: string | null
  user_id: string
  created_at: string
}

export interface LocalCreditAccount {
  _localId?: number
  id: string
  org_id: string
  sale_id: string
  customer_id: string
  total_amount: number
  paid_amount: number
  due_date: string | null
  status: 'active' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCreditPayment {
  _localId?: number
  id: string
  org_id: string
  credit_account_id: string
  amount: number
  payment_method: string
  reference: string | null
  notes: string | null
  voucher_url: string | null
  user_id: string
  created_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalSupplierDebt {
  _localId?: number
  id: string
  org_id: string
  supplier_id: string
  purchase_order_id: string | null
  total_amount: number
  paid_amount: number
  due_date: string | null
  status: 'active' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalSupplierPayment {
  _localId?: number
  id: string
  org_id: string
  supplier_id: string
  debt_id: string
  amount: number
  payment_method: string
  reference: string | null
  notes: string | null
  voucher_url: string | null
  user_id: string
  created_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCashRegister {
  _localId?: number
  id: string
  org_id: string
  name: string
  is_active: boolean
  created_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCashMovement {
  _localId?: number
  id: string
  org_id: string
  session_id: string
  type: 'income' | 'expense' | 'adjustment'
  amount: number
  description: string
  reference_type: string | null
  reference_id: string | null
  user_id: string
  created_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalUserProfile {
  _localId?: number
  id: string
  org_id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'seller' | 'warehouse' | 'accounting'
  is_active: boolean
  created_at: string
  updated_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCashSession {
  _localId?: number
  id: string
  org_id: string
  register_id: string
  user_id: string
  opening_amount: number
  closing_amount: number | null
  expected_amount: number | null
  difference: number | null
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed'
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

export interface LocalCompanySettings {
  _localId?: number
  id: string
  org_id: string
  trade_name: string | null
  legal_name: string | null
  tax_id: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  currency: string
  currency_symbol: string
  tax_rate: number
  tax_label: string
  invoice_series: string
  receipt_series: string
  po_series: string
  created_at: string
  updated_at: string
  _syncStatus: 'synced' | 'pending' | 'conflict'
}

class MiniERPDatabase extends Dexie {
  products!: Table<LocalProduct>
  categories!: Table<LocalCategory>
  brands!: Table<LocalBrand>
  units!: Table<LocalUnit>
  customers!: Table<LocalCustomer>
  suppliers!: Table<LocalSupplier>
  sales!: Table<LocalSale>
  saleItems!: Table<LocalSaleItem>
  purchaseOrders!: Table<LocalPurchaseOrder>
  purchaseOrderItems!: Table<LocalPurchaseOrderItem>
  inventoryMovements!: Table<LocalInventoryMovement>
  creditAccounts!: Table<LocalCreditAccount>
  creditPayments!: Table<LocalCreditPayment>
  supplierDebts!: Table<LocalSupplierDebt>
  supplierPayments!: Table<LocalSupplierPayment>
  cashRegisters!: Table<LocalCashRegister>
  cashSessions!: Table<LocalCashSession>
  cashMovements!: Table<LocalCashMovement>
  userProfiles!: Table<LocalUserProfile>
  companySettings!: Table<LocalCompanySettings>
  syncQueue!: Table<SyncOperation>
  syncMeta!: Table<SyncMeta>

  constructor() {
    super('minierp')

    this.version(1).stores({
      products: '++_localId, id, org_id, sku, barcode, name, category_id, is_active, _syncStatus',
      categories: '++_localId, id, org_id, name, _syncStatus',
      brands: '++_localId, id, org_id, name, _syncStatus',
      units: '++_localId, id, org_id, name, _syncStatus',
      customers: '++_localId, id, org_id, name, is_active, _syncStatus',
      suppliers: '++_localId, id, org_id, name, is_active, _syncStatus',
      sales: '++_localId, id, org_id, created_at, status, type, customer_id, _syncStatus',
      saleItems: '++_localId, id, sale_id, product_id',
      purchaseOrders: '++_localId, id, org_id, supplier_id, status, created_at, _syncStatus',
      purchaseOrderItems: '++_localId, id, purchase_order_id, product_id',
      inventoryMovements: '++_localId, id, org_id, product_id, type, created_at',
      creditAccounts: '++_localId, id, org_id, sale_id, customer_id, status, _syncStatus',
      creditPayments: '++_localId, id, org_id, credit_account_id, _syncStatus',
      cashSessions: '++_localId, id, org_id, register_id, status, _syncStatus',
      companySettings: '++_localId, id, org_id, _syncStatus',
      syncQueue: '++_localId, id, table_name, operation, status, created_at',
      syncMeta: 'table_name',
    })

    this.version(2).stores({
      products: '++_localId, id, org_id, sku, barcode, name, category_id, is_active, _syncStatus',
      categories: '++_localId, id, org_id, name, _syncStatus',
      brands: '++_localId, id, org_id, name, _syncStatus',
      units: '++_localId, id, org_id, name, _syncStatus',
      customers: '++_localId, id, org_id, name, is_active, _syncStatus',
      suppliers: '++_localId, id, org_id, name, is_active, _syncStatus',
      sales: '++_localId, id, org_id, created_at, status, type, customer_id, _syncStatus',
      saleItems: '++_localId, id, sale_id, product_id',
      purchaseOrders: '++_localId, id, org_id, supplier_id, status, created_at, _syncStatus',
      purchaseOrderItems: '++_localId, id, purchase_order_id, product_id',
      inventoryMovements: '++_localId, id, org_id, product_id, type, created_at',
      creditAccounts: '++_localId, id, org_id, sale_id, customer_id, status, _syncStatus',
      creditPayments: '++_localId, id, org_id, credit_account_id, _syncStatus',
      supplierDebts: '++_localId, id, org_id, supplier_id, purchase_order_id, status, _syncStatus',
      supplierPayments: '++_localId, id, org_id, supplier_id, debt_id, _syncStatus',
      cashSessions: '++_localId, id, org_id, register_id, status, _syncStatus',
      companySettings: '++_localId, id, org_id, _syncStatus',
      syncQueue: '++_localId, id, table_name, operation, status, created_at',
      syncMeta: 'table_name',
    })

    this.version(3).stores({
      products: '++_localId, id, org_id, sku, barcode, name, category_id, is_active, _syncStatus',
      categories: '++_localId, id, org_id, name, _syncStatus',
      brands: '++_localId, id, org_id, name, _syncStatus',
      units: '++_localId, id, org_id, name, _syncStatus',
      customers: '++_localId, id, org_id, name, is_active, _syncStatus',
      suppliers: '++_localId, id, org_id, name, is_active, _syncStatus',
      sales: '++_localId, id, org_id, created_at, status, type, customer_id, _syncStatus',
      saleItems: '++_localId, id, sale_id, product_id',
      purchaseOrders: '++_localId, id, org_id, supplier_id, status, created_at, _syncStatus',
      purchaseOrderItems: '++_localId, id, purchase_order_id, product_id',
      inventoryMovements: '++_localId, id, org_id, product_id, type, created_at',
      creditAccounts: '++_localId, id, org_id, sale_id, customer_id, status, _syncStatus',
      creditPayments: '++_localId, id, org_id, credit_account_id, _syncStatus',
      supplierDebts: '++_localId, id, org_id, supplier_id, purchase_order_id, status, _syncStatus',
      supplierPayments: '++_localId, id, org_id, supplier_id, debt_id, _syncStatus',
      cashRegisters: '++_localId, id, org_id, _syncStatus',
      cashSessions: '++_localId, id, org_id, register_id, status, _syncStatus',
      cashMovements: '++_localId, id, org_id, session_id, type, _syncStatus',
      userProfiles: '++_localId, id, org_id, role, is_active, _syncStatus',
      companySettings: '++_localId, id, org_id, _syncStatus',
      syncQueue: '++_localId, id, table_name, operation, status, created_at',
      syncMeta: 'table_name',
    })
  }
}

export const db = new MiniERPDatabase()

/**
 * Upsert por campo `id` en tablas con clave primaria ++_localId.
 * Actualiza el registro existente (sin duplicar) o lo inserta si no existe.
 */
export async function upsertById<T extends { id: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: import('dexie').Table<T, any>,
  record: T
): Promise<void> {
  const updated = await table.where('id').equals(record.id).modify(record as Partial<T>)
  if (updated === 0) {
    await table.put(record)
  }
}
