export interface Category {
  id: string
  org_id: string
  name: string
  description: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Brand {
  id: string
  org_id: string
  name: string
  created_at: string
  deleted_at: string | null
}

export interface Unit {
  id: string
  org_id: string
  name: string
  abbreviation: string
  created_at: string
}

export type CreateCategoryDto = Pick<Category, 'name' | 'description' | 'parent_id'>
export type CreateBrandDto = Pick<Brand, 'name'>
export type CreateUnitDto = Pick<Unit, 'name' | 'abbreviation'>
