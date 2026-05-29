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
import { customerSchema, type CustomerFormData } from '../customer.schema'
import type { Customer } from '../types'

interface Props {
  customer?: Customer | null
  onSubmit: (data: CustomerFormData) => Promise<void>
  onCancel: () => void
}

export function CustomerForm({ customer, onSubmit, onCancel }: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      tax_id: '',
      phone: '',
      email: '',
      address: '',
      credit_limit: 0,
      notes: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        tax_id: customer.tax_id ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        credit_limit: customer.credit_limit,
        notes: customer.notes ?? '',
        is_active: customer.is_active,
      })
    }
  }, [customer, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Datos principales */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Nombre / Razón social *</Label>
          <Input id="name" placeholder="Ej: Juan Pérez" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_id">DNI / RUC</Label>
          <Input id="tax_id" placeholder="Ej: 12345678" {...register('tax_id')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" placeholder="Ej: 999 888 777" {...register('phone')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" placeholder="cliente@correo.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="credit_limit">Límite de crédito</Label>
          <Input
            id="credit_limit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register('credit_limit')}
          />
          {errors.credit_limit && <p className="text-xs text-destructive">{errors.credit_limit.message}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" placeholder="Av. Principal 123, Lima" {...register('address')} />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notas</Label>
          <Textarea id="notes" placeholder="Observaciones del cliente..." rows={2} {...register('notes')} />
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
        <Label className="cursor-pointer">Cliente activo</Label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {customer ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  )
}
