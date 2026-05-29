import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'
import { supplierSchema, type SupplierFormData } from '../supplier.schema'
import type { Supplier } from '../types'

interface Props {
  supplier?: Supplier | null
  onSubmit: (data: SupplierFormData) => Promise<void>
  onCancel: () => void
}

export function SupplierForm({ supplier, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      tax_id: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (supplier) {
      reset({
        name: supplier.name,
        tax_id: supplier.tax_id ?? '',
        contact_name: supplier.contact_name ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        notes: supplier.notes ?? '',
        is_active: supplier.is_active,
      })
    }
  }, [supplier, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sup-name">Nombre / Razón social *</Label>
          <Input id="sup-name" placeholder="Ej: Distribuidora Lima S.A.C." {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sup-tax">RUC / NIT</Label>
          <Input id="sup-tax" placeholder="Ej: 20123456789" {...register('tax_id')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sup-contact">Nombre de contacto</Label>
          <Input id="sup-contact" placeholder="Ej: María García" {...register('contact_name')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sup-phone">Teléfono</Label>
          <Input id="sup-phone" placeholder="Ej: 01-234-5678" {...register('phone')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sup-email">Correo electrónico</Label>
          <Input id="sup-email" type="email" placeholder="ventas@proveedor.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sup-address">Dirección</Label>
          <Input id="sup-address" placeholder="Av. Industrial 456, Lima" {...register('address')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sup-notes">Notas</Label>
          <Textarea
            id="sup-notes"
            placeholder="Condiciones de pago, observaciones..."
            rows={2}
            {...register('notes')}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label className="cursor-pointer">Proveedor activo</Label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {supplier ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
      </div>
    </form>
  )
}
