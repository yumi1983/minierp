export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled'

export interface PurchaseOrder {
  id: string
  org_id: string
  supplier_id: string
  series: string
  number: number
  status: POStatus
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
}

export interface PurchaseOrderItem {
  id: string
  purchase_order_id: string
  product_id: string
  quantity: number
  unit_price: number
  subtotal: number
  received_quantity: number
  rejected_quantity: number
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[]
  supplier_name?: string
}

export interface ReceptionItemData {
  item_id: string
  received_qty: number
  rejected_qty: number
}

export interface ReceptionData {
  items: ReceptionItemData[]
  freight_cost: number
  notes: string
}

export interface SupplierDebt {
  id: string
  org_id: string
  supplier_id: string
  purchase_order_id: string | null
  total_amount: number
  paid_amount: number
  balance: number
  due_date: string | null
  status: 'active' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
}

export interface SupplierPayment {
  id: string
  org_id: string
  supplier_id: string
  debt_id: string | null
  amount: number
  payment_method: 'cash' | 'card' | 'transfer' | 'check'
  reference: string | null
  notes: string | null
  user_id: string
  created_at: string
}
