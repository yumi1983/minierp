import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sku: z.string().optional().or(z.literal('')),
  barcode: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  category_id: z.string().optional().or(z.literal('')),
  brand_id: z.string().optional().or(z.literal('')),
  unit_id: z.string().optional().or(z.literal('')),
  purchase_price: z.coerce.number().min(0, 'Debe ser mayor o igual a 0'),
  sale_price: z.coerce.number().min(0, 'Debe ser mayor o igual a 0'),
  stock: z.coerce.number().min(0, 'No puede ser negativo'),
  min_stock: z.coerce.number().min(0, 'No puede ser negativo'),
  is_active: z.boolean().default(true),
  image_url: z.string().nullable().optional(),
})

export type ProductFormData = z.infer<typeof productSchema>
