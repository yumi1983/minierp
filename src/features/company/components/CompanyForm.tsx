import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { LogoUpload } from './LogoUpload'
import { companySchema, type CompanyFormData } from '../company.schema'
import { useCompany } from '../hooks/useCompany'

const CURRENCIES = [
  { value: 'PEN', label: 'Sol peruano (PEN)', symbol: 'S/' },
  { value: 'USD', label: 'Dólar americano (USD)', symbol: '$' },
  { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { value: 'MXN', label: 'Peso mexicano (MXN)', symbol: '$' },
  { value: 'COP', label: 'Peso colombiano (COP)', symbol: '$' },
  { value: 'CLP', label: 'Peso chileno (CLP)', symbol: '$' },
  { value: 'BOB', label: 'Boliviano (BOB)', symbol: 'Bs.' },
]

export function CompanyForm() {
  const { settings, isLoading, save, uploadLogo } = useCompany()

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      trade_name: '',
      legal_name: '',
      tax_id: '',
      address: '',
      phone: '',
      email: '',
      currency: 'PEN',
      currency_symbol: 'S/',
      tax_rate: 18,
      tax_label: 'IGV',
      invoice_series: 'F001',
      receipt_series: 'B001',
      po_series: 'OC001',
    },
  })

  // Llenar formulario cuando cargan los datos
  useEffect(() => {
    if (settings) {
      reset({
        trade_name: settings.trade_name ?? '',
        legal_name: settings.legal_name ?? '',
        tax_id: settings.tax_id ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        currency: settings.currency,
        currency_symbol: settings.currency_symbol,
        tax_rate: settings.tax_rate,
        tax_label: settings.tax_label,
        invoice_series: settings.invoice_series,
        receipt_series: settings.receipt_series,
        po_series: settings.po_series,
      })
    }
  }, [settings, reset])

  // Actualizar símbolo automáticamente al cambiar moneda
  const currency = watch('currency')
  useEffect(() => {
    const found = CURRENCIES.find((c) => c.value === currency)
    if (found) setValue('currency_symbol', found.symbol)
  }, [currency, setValue])

  const onSubmit = async (data: CompanyFormData) => {
    try {
      await save({
        ...data,
        logo_url: settings?.logo_url ?? null,
        trade_name: data.trade_name,
        legal_name: data.legal_name || null,
        tax_id: data.tax_id || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
      })
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar la configuración')
    }
  }

  const handleLogoChange = async (url: string | null) => {
    if (settings) {
      await save({ ...settings, logo_url: url })
    }
  }

  if (isLoading && !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo de la empresa</CardTitle>
          <CardDescription>Se usará en PDFs, reportes y comprobantes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <LogoUpload
              value={settings?.logo_url ?? null}
              onChange={handleLogoChange}
              onUpload={uploadLogo}
            />
          </div>
        </CardContent>
      </Card>

      {/* Datos generales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la empresa</CardTitle>
          <CardDescription>Información que aparecerá en documentos oficiales</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="trade_name">
              Nombre comercial <span className="text-destructive">*</span>
            </Label>
            <Input id="trade_name" placeholder="Mi Negocio S.A.C." {...register('trade_name')} />
            {errors.trade_name && <p className="text-xs text-destructive">{errors.trade_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="legal_name">Razón social</Label>
            <Input id="legal_name" placeholder="MI NEGOCIO SOCIEDAD ANONIMA CERRADA" {...register('legal_name')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tax_id">RUC / NIT / RFC</Label>
            <Input id="tax_id" placeholder="20123456789" {...register('tax_id')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" placeholder="+51 999 888 777" {...register('phone')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="contacto@empresa.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Dirección</Label>
            <Textarea
              id="address"
              placeholder="Av. Principal 123, Lima, Perú"
              rows={2}
              {...register('address')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configuración fiscal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moneda e impuestos</CardTitle>
          <CardDescription>Configuración usada en todos los cálculos del sistema</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Moneda</Label>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currency_symbol">Símbolo de moneda</Label>
            <Input id="currency_symbol" placeholder="S/" {...register('currency_symbol')} />
            {errors.currency_symbol && <p className="text-xs text-destructive">{errors.currency_symbol.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tax_label">Nombre del impuesto</Label>
            <Input id="tax_label" placeholder="IGV" {...register('tax_label')} />
            {errors.tax_label && <p className="text-xs text-destructive">{errors.tax_label.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tax_rate">Tasa de impuesto (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              step="0.01"
              placeholder="18"
              {...register('tax_rate')}
            />
            {errors.tax_rate && <p className="text-xs text-destructive">{errors.tax_rate.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Series de documentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Series de documentos</CardTitle>
          <CardDescription>Prefijo que se usará para numerar los comprobantes</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="invoice_series">Serie de facturas</Label>
            <Input id="invoice_series" placeholder="F001" {...register('invoice_series')} />
            {errors.invoice_series && <p className="text-xs text-destructive">{errors.invoice_series.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="receipt_series">Serie de boletas</Label>
            <Input id="receipt_series" placeholder="B001" {...register('receipt_series')} />
            {errors.receipt_series && <p className="text-xs text-destructive">{errors.receipt_series.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po_series">Serie de órdenes de compra</Label>
            <Input id="po_series" placeholder="OC001" {...register('po_series')} />
            {errors.po_series && <p className="text-xs text-destructive">{errors.po_series.message}</p>}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
