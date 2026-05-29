export interface Product {
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
}

export type CreateProductDto = Omit<Product, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'deleted_at'>
