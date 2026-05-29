export interface Supplier {
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
}

export type CreateSupplierDto = Omit<Supplier, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at'>
