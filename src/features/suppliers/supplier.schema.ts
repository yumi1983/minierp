import { z } from 'zod'

export const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  tax_id: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().optional().refine(
    v => !v || z.string().email().safeParse(v).success,
    { message: 'Correo inválido' }
  ),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
})

export type SupplierFormData = z.infer<typeof supplierSchema>
