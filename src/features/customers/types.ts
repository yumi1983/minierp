export interface Customer {
  id: string
  org_id: string
  name: string
  tax_id: string | null       // DNI / RUC
  phone: string | null
  email: string | null
  address: string | null
  credit_limit: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type CreateCustomerDto = Omit<Customer, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at'>
