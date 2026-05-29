export type DebtStatus = 'active' | 'paid' | 'overdue'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check'

export interface SupplierDebt {
  id: string
  org_id: string
  supplier_id: string
  purchase_order_id: string | null
  total_amount: number
  paid_amount: number
  due_date: string | null
  status: DebtStatus
  created_at: string
  updated_at: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface SupplierPayment {
  id: string
  org_id: string
  supplier_id: string
  debt_id: string
  amount: number
  payment_method: PaymentMethod
  reference: string | null
  notes: string | null
  voucher_url: string | null
  user_id: string
  created_at: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface SupplierDebtWithDetail extends SupplierDebt {
  supplier_name: string
  order_code: string
  balance: number
  payments: SupplierPayment[]
}

export interface SupplierPaymentHistoryEntry extends SupplierPayment {
  supplier_name: string
  order_code: string
}
