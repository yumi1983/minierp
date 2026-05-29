import { useEffect } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { formatCurrency } from '@/shared/utils/currency'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useUnits } from '@/features/catalog/hooks/useUnits'
import { useCompanyStore } from '@/features/company/store/company.store'
import { nanoid } from 'nanoid'
import { purchaseOrderSchema, type PurchaseOrderFormData } from '../purchase.schema'

interface InitialData {
  supplier_id: string
  issue_date: string | null
  expected_date: string | null
  notes: string | null
  tax_rate: number
  items: Array<{ id: string; product_id: string; quantity: number; unit_price: number }>
}

interface Props {
  initialData?: InitialData
  onSubmit: (data: PurchaseOrderFormData) => Promise<void>
  onCancel: () => void
}

export function PurchaseOrderForm({ initialData, onSubmit, onCancel }: Props) {
  const { suppliers } = useSuppliers()
  const { products } = useProducts()
  const { units } = useUnits()
  const companySettings = useCompanyStore(s => s.settings)

  const unitMap = Object.fromEntries(units.map(u => [u.id, u.abbreviation]))

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<PurchaseOrderFormData>({
      resolver: zodResolver(purchaseOrderSchema),
      defaultValues: initialData ? {
        supplier_id: initialData.supplier_id,
        issue_date: initialData.issue_date ?? new Date().toISOString().split('T')[0],
        expected_date: initialData.expected_date ?? '',
        notes: initialData.notes ?? '',
        tax_rate: initialData.tax_rate,
        items: initialData.items.map(i => ({ ...i, product_name: '' })),
      } : {
        supplier_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        expected_date: '',
        notes: '',
        tax_rate: 0,
        items: [{ id: nanoid(), product_id: '', quantity: 1, unit_price: 0 }],
      },
    })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const items = watch('items')
  const watchTaxRate = watch('tax_rate')

  // Recalcular subtotales automáticamente
  useEffect(() => {
    items.forEach((item, idx) => {
      const sub = (item.quantity || 0) * (item.unit_price || 0)
      setValue(`items.${idx}.subtotal`, sub)
    })
  }, [JSON.stringify(items.map(i => ({ q: i.quantity, p: i.unit_price })))])

  const subtotal = items.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0)
  const taxAmount = subtotal * ((watchTaxRate || 0) / 100)
  const total = subtotal + taxAmount

  const handleProductChange = (idx: number, productId: string) => {
    if (productId === 'none') { setValue(`items.${idx}.product_id`, ''); return }
    const product = products.find(p => p.id === productId)
    if (product) {
      setValue(`items.${idx}.product_id`, productId)
      setValue(`items.${idx}.product_name`, product.name)
      setValue(`items.${idx}.unit_price`, product.purchase_price)
    }
  }

  const handleSubmitForm = async (data: PurchaseOrderFormData) => {
    if (data.items.some(i => !i.product_id)) {
      toast.error('Todos los ítems deben tener un producto')
      return
    }
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-5">
      {/* Proveedor y fechas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Proveedor *</Label>
          <Controller
            name="supplier_id"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || 'none'}
                onValueChange={v => field.onChange(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seleccionar proveedor</SelectItem>
                  {suppliers.filter(s => s.is_active).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.supplier_id && <p className="text-xs text-destructive">{errors.supplier_id.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="issue_date">Fecha de emisión *</Label>
          <Input id="issue_date" type="date" {...register('issue_date')} />
          {errors.issue_date && <p className="text-xs text-destructive">{errors.issue_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expected_date">Fecha de entrega esperada</Label>
          <Input id="expected_date" type="date" {...register('expected_date')} />
          {errors.expected_date && <p className="text-xs text-destructive">{errors.expected_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tax_rate">IGV / Impuesto (%)</Label>
          <Input id="tax_rate" type="number" step="0.01" min="0" max="100" {...register('tax_rate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="po-notes">Notas</Label>
          <Input id="po-notes" placeholder="Observaciones..." {...register('notes')} />
        </div>
      </div>

      <Separator />

      {/* Líneas de productos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Productos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ id: nanoid(), product_id: '', quantity: 1, unit_price: 0 })}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar ítem
          </Button>
        </div>

        {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
          <p className="text-xs text-destructive">{errors.items.message as string}</p>
        )}

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-20">Unidad</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Cantidad</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-32">P. Unit.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-32">Subtotal</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fields.map((field, idx) => {
                const sub = (items[idx]?.quantity || 0) * (items[idx]?.unit_price || 0)
                const selectedProduct = products.find(p => p.id === items[idx]?.product_id)
                const unitAbbr = selectedProduct?.unit_id ? (unitMap[selectedProduct.unit_id] ?? '—') : '—'
                return (
                  <tr key={field.id}>
                    <td className="px-3 py-2">
                      <Controller
                        name={`items.${idx}.product_id`}
                        control={control}
                        render={({ field: f }) => (
                          <Select
                            value={f.value || 'none'}
                            onValueChange={v => handleProductChange(idx, v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccionar producto</SelectItem>
                              {products.filter(p => p.is_active).map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground font-medium">
                      {unitAbbr}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        className="h-8 text-xs text-right"
                        {...register(`items.${idx}.quantity`)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-xs text-right"
                        {...register(`items.${idx}.unit_price`)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                      {formatCurrency(sub)}
                    </td>
                    <td className="px-3 py-2">
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => remove(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totales */}
      <div className="flex justify-end">
        <div className="w-56 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{companySettings?.tax_label ?? 'IGV'} ({watchTaxRate}%)</span>
            <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {initialData ? 'Guardar cambios' : 'Crear orden de compra'}
        </Button>
      </div>
    </form>
  )
}
