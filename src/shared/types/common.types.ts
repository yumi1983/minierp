export type SyncStatus = 'synced' | 'pending' | 'conflict'

export type UserRole = 'admin' | 'seller' | 'warehouse' | 'accounting'

export type MovementType = 'IN' | 'OUT' | 'ADJ' | 'TRANSFER'

export type SaleType = 'cash' | 'credit'

export type SaleStatus = 'draft' | 'confirmed' | 'cancelled'

export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export type DebtStatus = 'active' | 'paid' | 'overdue'

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check'

export type CashMovementType = 'income' | 'expense' | 'adjustment'

export interface BaseEntity {
  id: string
  org_id: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncStatus?: SyncStatus
  _localId?: number
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface FilterParams {
  search?: string
  [key: string]: unknown
}

export interface SelectOption {
  value: string
  label: string
}
