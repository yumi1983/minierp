import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  tax_id: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().optional().refine(
    v => !v || z.string().email().safeParse(v).success,
    { message: 'Correo inválido' }
  ),
  address: z.string().optional().or(z.literal('')),
  credit_limit: z.coerce.number().min(0, 'Debe ser 0 o mayor'),
  notes: z.string().optional().or(z.literal('')),
  is_active: z.boolean().default(true),
})

export type CustomerFormData = z.infer<typeof customerSchema>
