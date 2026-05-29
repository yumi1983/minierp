export type SaleType = 'cash' | 'credit'
export type SaleStatus = 'draft' | 'confirmed' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check'

export interface Sale {
  id: string
  org_id: string
  customer_id: string | null
  series: string
  number: number
  type: SaleType
  status: SaleStatus
  subtotal: number
  discount: number
  tax_rate: number
  tax_amount: number
  total: number
  payment_method: PaymentMethod | null
  cash_session_id: string | null
  freight_cost: number | null
  notes: string | null
  user_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
  customer_name?: string
}

// Estado del carrito POS
export interface CartItem {
  product_id: string
  product_name: string
  sku: string | null
  unit_price: number
  quantity: number
  discount: number
  subtotal: number
  stock: number
}
