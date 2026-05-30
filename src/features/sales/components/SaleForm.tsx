import { useState } from 'react'
import { Plus, Trash2, Loader2, Banknote, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatCurrency } from '@/shared/utils/currency'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useUnits } from '@/features/catalog/hooks/useUnits'
import { useCompanyStore } from '@/features/company/store/company.store'
import { generateUUID } from '@/shared/utils/uuid'
import type { SaleType, PaymentMethod } from '../types'

interface SaleFormItem {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
}

interface SaleFormData {
  items: SaleFormItem[]
  customer_id: string | null
  type: SaleType
  payment_method: PaymentMethod
  globalDiscount: number
  freightCost: number
  notes: string
  taxRate: number
  saleDate: string
  advanceAmount: number
  advanceMethod: PaymentMethod
}

interface Props {
  onSubmit: (data: Omit<SaleFormData, 'advanceCashSessionId'>) => Promise<void>
  onCancel: () => void
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  check: 'Cheque',
}

function emptyItem(): SaleFormItem {
  return { id: generateUUID(), product_id: '', quantity: 1, unit_price: 0, discount: 0 }
}

export function SaleForm({ onSubmit, onCancel }: Props) {
  const { products } = useProducts()
  const { customers } = useCustomers()
  const { units } = useUnits()
  const companySettings = useCompanyStore(s => s.settings)
  const unitMap = Object.fromEntries(units.map(u => [u.id, u.abbreviation]))

  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<SaleFormItem[]>([emptyItem()])
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [type, setType] = useState<SaleType>('cash')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [taxRate, setTaxRate] = useState(0)
  const [globalDiscount, setGlobalDiscount] = useState(0)
  const [freightCost, setFreightCost] = useState(0)
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [advanceAmount, setAdvanceAmount] = useState(0)
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('cash')

  const taxLabel = companySettings?.tax_label ?? 'IGV'

  // Totales
  const itemsSubtotal = items.reduce((s, i) => {
    const sub = i.quantity * i.unit_price * (1 - i.discount / 100)
    return s + sub
  }, 0)
  const discountAmount = itemsSubtotal * (globalDiscount / 100)
  const subtotal = itemsSubtotal - discountAmount
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount
  const effectiveAdvance = Math.min(advanceAmount, total)

  const updateItem = (id: string, field: keyof SaleFormItem, value: string | number) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: value }
      if (field === 'product_id') {
        const product = products.find(p => p.id === value)
        if (product) updated.unit_price = product.sale_price
      }
      return updated
    }))
  }

  const removeItem = (id: string) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const handleSubmit = async () => {
    if (items.some(i => !i.product_id)) {
      toast.error('Todos los ítems deben tener un producto seleccionado')
      return
    }
    if (items.some(i => i.quantity <= 0)) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }
    if (type === 'credit' && !customerId) {
      toast.error('Las ventas a crédito requieren un cliente')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        items,
        customer_id: customerId,
        type,
        payment_method: paymentMethod,
        globalDiscount,
        freightCost,
        notes,
        taxRate,
        saleDate,
        advanceAmount: type === 'credit' ? effectiveAdvance : 0,
        advanceMethod,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar venta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Sección: datos generales ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Fecha de venta *</Label>
          <Input
            type="date"
            value={saleDate}
            max={new Date().toISOString().split('T')[0]}
            onChange={e => setSaleDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label className="text-xs">Cliente {type === 'credit' && <span className="text-destructive">*</span>}</Label>
          <Select value={customerId ?? 'none'} onValueChange={v => setCustomerId(v === 'none' ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Sin cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin cliente</SelectItem>
              {customers.filter(c => c.is_active).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{taxLabel} (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={taxRate}
            onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
          />
        </div>
      </div>

      {/* ── Tipo de venta ── */}
      <div className="grid grid-cols-2 gap-2 max-w-xs">
        <button
          type="button"
          onClick={() => setType('cash')}
          className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
            type === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <Banknote className="h-4 w-4" />
          Contado
        </button>
        <button
          type="button"
          onClick={() => setType('credit')}
          className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
            type === 'credit' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Crédito
        </button>
      </div>

      {type === 'cash' && (
        <div className="space-y-1.5 max-w-xs">
          <Label className="text-xs">Método de pago</Label>
          <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* ── Tabla de productos ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Productos</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setItems(prev => [...prev, emptyItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar ítem
          </Button>
        </div>

        <div className="rounded-lg border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-20">Unidad</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-36">Cantidad</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-40">P. Unit.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Dto. %</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-36">Subtotal</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, idx) => {
                const product = products.find(p => p.id === item.product_id)
                const unitAbbr = product?.unit_id ? (unitMap[product.unit_id] ?? '—') : '—'
                const sub = item.quantity * item.unit_price * (1 - item.discount / 100)
                return (
                  <tr key={item.id}>
                    <td className="px-3 py-2 text-xs text-muted-foreground text-center w-8">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <Select
                        value={item.product_id || 'none'}
                        onValueChange={v => updateItem(item.id, 'product_id', v === 'none' ? '' : v)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Seleccionar producto</SelectItem>
                          {products.filter(p => p.is_active).map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.sku ? ` — ${p.sku}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground font-medium">
                      {unitAbbr}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm text-right w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm text-right w-full"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.discount}
                        onChange={e => updateItem(item.id, 'discount', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm text-right w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-sm font-medium">
                      {formatCurrency(sub)}
                    </td>
                    <td className="px-3 py-2">
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
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

      <Separator />

      {/* ── Sección inferior: opciones + totales ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Izquierda: campos adicionales */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Descuento global (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={globalDiscount}
                onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Flete empresa (no se cobra)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={freightCost || ''}
                placeholder="0.00"
                onChange={e => setFreightCost(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observaciones</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas de la venta..."
              rows={3}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {type === 'credit' && (
            <div className="rounded-lg border p-3 space-y-2">
              <Label className="text-xs font-medium">Adelanto a cuenta (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  max={total}
                  value={advanceAmount || ''}
                  placeholder="0.00"
                  onChange={e => setAdvanceAmount(Math.min(parseFloat(e.target.value) || 0, total))}
                  className="w-36 text-right"
                />
                <Select value={advanceMethod} onValueChange={v => setAdvanceMethod(v as PaymentMethod)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Derecha: totales */}
        <div className="flex flex-col justify-end">
          <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal bruto</span>
              <span className="tabular-nums">{formatCurrency(itemsSubtotal)}</span>
            </div>
            {globalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Descuento global ({globalDiscount}%)</span>
                <span className="tabular-nums">-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{taxLabel} ({taxRate}%)</span>
              <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
            </div>
            {freightCost > 0 && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Flete <span className="bg-muted rounded px-1">empresa</span></span>
                <span className="tabular-nums">{formatCurrency(freightCost)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL</span>
              <span className="tabular-nums text-primary">{formatCurrency(total)}</span>
            </div>
            {type === 'credit' && effectiveAdvance > 0 && (
              <>
                <div className="flex justify-between text-emerald-600">
                  <span>Adelanto ({PAYMENT_LABELS[advanceMethod]})</span>
                  <span className="tabular-nums">-{formatCurrency(effectiveAdvance)}</span>
                </div>
                <div className="flex justify-between font-semibold text-destructive">
                  <span>Saldo por cobrar</span>
                  <span className="tabular-nums">{formatCurrency(total - effectiveAdvance)}</span>
                </div>
              </>
            )}
            {type === 'credit' && (
              <p className="text-xs text-amber-600 pt-1">
                Se generará una cuenta por cobrar de {formatCurrency(type === 'credit' && effectiveAdvance > 0 ? total - effectiveAdvance : total)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Botones ── */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Registrar venta
        </Button>
      </div>
    </div>
  )
}
