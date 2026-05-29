import { z } from 'zod'

export const companySchema = z.object({
  trade_name: z.string().min(1, 'El nombre comercial es requerido'),
  legal_name: z.string().optional().or(z.literal('')),
  tax_id: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z
    .string()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, {
      message: 'Correo electrónico inválido',
    }),
  currency: z.string().min(1, 'Requerido'),
  currency_symbol: z.string().min(1, 'Requerido'),
  tax_rate: z.coerce
    .number()
    .min(0, 'Debe ser mayor o igual a 0')
    .max(100, 'Debe ser menor o igual a 100'),
  tax_label: z.string().min(1, 'Requerido'),
  invoice_series: z.string().min(1, 'Requerido'),
  receipt_series: z.string().min(1, 'Requerido'),
  po_series: z.string().min(1, 'Requerido'),
})

export type CompanyFormData = z.infer<typeof companySchema>
