import { z } from 'zod'

export const purchaseItemSchema = z.object({
  id: z.string(),
  product_id: z.string().min(1, 'Selecciona un producto'),
  product_name: z.string().optional(),
  quantity: z.coerce.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  unit_price: z.coerce.number().min(0, 'El precio no puede ser negativo'),
  subtotal: z.number().optional(),
})

export const purchaseOrderSchema = z
  .object({
    supplier_id: z.string().min(1, 'Selecciona un proveedor'),
    issue_date: z.string().min(1, 'La fecha de emisión es requerida'),
    expected_date: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
    tax_rate: z.coerce.number().min(0).max(100).default(18),
    items: z.array(purchaseItemSchema).min(1, 'Agrega al menos un producto'),
  })
  .refine(
    data => {
      if (!data.expected_date || !data.issue_date) return true
      return data.expected_date >= data.issue_date
    },
    {
      message: 'La fecha de entrega no puede ser anterior a la fecha de emisión',
      path: ['expected_date'],
    }
  )

export type PurchaseOrderFormData = z.infer<typeof purchaseOrderSchema>
export type PurchaseItemFormData = z.infer<typeof purchaseItemSchema>
