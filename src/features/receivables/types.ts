export type DebtStatus = 'active' | 'paid' | 'overdue'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check'

export interface CreditAccount {
  id: string
  org_id: string
  sale_id: string
  customer_id: string
  total_amount: number
  paid_amount: number
  due_date: string | null
  status: DebtStatus
  created_at: string
  updated_at: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface CreditPayment {
  id: string
  org_id: string
  credit_account_id: string
  amount: number
  payment_method: PaymentMethod
  reference: string | null
  notes: string | null
  voucher_url: string | null
  user_id: string
  created_at: string
  _syncStatus?: 'synced' | 'pending' | 'conflict'
}

export interface CreditAccountWithDetail extends CreditAccount {
  customer_name: string
  sale_code: string
  balance: number
  payments: CreditPayment[]
}

export interface PaymentHistoryEntry extends CreditPayment {
  customer_id: string
  customer_name: string
  sale_code: string
  total_amount: number
}
