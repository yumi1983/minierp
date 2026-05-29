import { useState } from 'react'
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, Loader2, FileText, CreditCard, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatCurrency } from '@/shared/utils/currency'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useCompanyStore } from '@/features/company/store/company.store'
import { useCashRegister } from '@/features/cash-register/hooks/useCashRegister'
import { useCartStore } from '../store/cartStore'
import { useSales } from '../hooks/useSales'
import { generateSaleNotePdf } from '../utils/generateSaleNotePdf'
import { db } from '@/core/db/dexie'
import type { SaleWithItems } from '../types'

interface Props {
  onSaleConfirmed?: (sale: SaleWithItems) => void
}

export function CartPanel({ onSaleConfirmed }: Props) {
  const {
    items, customer_id, customer_name, type, payment_method,
    discount, freightCost, notes, saleDate, advanceAmount, advanceMethod,
    updateQuantity, updatePrice, updateDiscount, removeItem,
    setCustomer, setType, setPaymentMethod, setGlobalDiscount, setFreightCost, setNotes,
    setSaleDate, setAdvanceAmount, setAdvanceMethod, clear,
  } = useCartStore()

  const { customers } = useCustomers()
  const companySettings = useCompanyStore(s => s.settings)
  const { confirm } = useSales()
  const { openSession } = useCashRegister()
  const [confirming, setConfirming] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [taxRate, setTaxRate] = useState<number>(0)

  const taxLabel = companySettings?.tax_label ?? 'IGV'

  const itemsSubtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const discountAmount = itemsSubtotal * (discount / 100)
  const subtotal = itemsSubtotal - discountAmount
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const handleConfirm = async () => {
    if (items.length === 0) { toast.error('El carrito está vacío'); return }
    if (type === 'credit' && !customer_id) { toast.error('Selecciona un cliente para venta a crédito'); return }

    setConfirming(true)
    try {
      const sale = await confirm({
        items,
        customer_id,
        type,
        payment_method,
        globalDiscount: discount,
        freightCost,
        notes,
        taxRate,
        saleDate,
        cashSessionId: type === 'cash' ? (openSession?.id ?? null) : null,
        advanceAmount: type === 'credit' ? advanceAmount : 0,
        advanceMethod,
        advanceCashSessionId: openSession?.id ?? null,
      })
      onSaleConfirmed?.(sale)

      // Generar PDF automáticamente
      const productNames: Record<string, string> = {}
      for (const item of sale.items) {
        const p = await db.products.where('id').equals(item.product_id).first()
        if (p) productNames[item.product_id] = p.name
      }
      await generateSaleNotePdf(
        sale, productNames, customer_name, companySettings,
        type === 'credit' ? advanceAmount : 0,
        type === 'credit' ? advanceMethod : '',
      )
      clear()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al confirmar venta'
      toast.error(msg)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header - fijo arriba */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="font-semibold">Carrito</h3>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="text-xs text-muted-foreground h-7">
            Limpiar
          </Button>
        )}
      </div>

      {/* Zona scrollable: ítems + configuración */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3">
        {/* Items */}
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Agrega productos desde la izquierda
            </div>
          ) : (
            items.map(item => (
              <div key={item.product_id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>S/</span>
                    <input
                      type="number"
                      value={item.unit_price}
                      min="0"
                      step="0.01"
                      onChange={e => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-20 rounded border bg-transparent px-1 text-right focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span>c/u</span>
                  </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Cantidad */}
                  <div className="flex items-center rounded-md border">
                    <button
                      className="px-2 py-1 hover:bg-accent"
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      min="0.001"
                      step="0.001"
                      onChange={e => updateQuantity(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-14 bg-transparent text-center text-sm focus:outline-none"
                    />
                    <button
                      className="px-2 py-1 hover:bg-accent"
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Descuento */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Dto:</span>
                    <input
                      type="number"
                      value={item.discount}
                      min="0"
                      max="100"
                      onChange={e => updateDiscount(item.product_id, parseFloat(e.target.value) || 0)}
                      className="w-10 rounded border bg-transparent px-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span>%</span>
                  </div>

                  <div className="ml-auto text-sm font-semibold">
                    {formatCurrency(item.subtotal)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Configuración de venta */}
        {items.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            {/* Fecha de venta */}
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Fecha de venta:</Label>
              <Input
                type="date"
                value={saleDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setSaleDate(e.target.value)}
                className="h-7 text-xs flex-1"
              />
            </div>

            {/* Tipo de venta */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setType('cash')}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  type === 'cash' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <Banknote className="h-4 w-4" />
                Contado
              </button>
              <button
                onClick={() => setType('credit')}
                className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  type === 'credit' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent'
                }`}
              >
                <CreditCard className="h-4 w-4" />
                Crédito
              </button>
            </div>

            {/* Cliente */}
            <div className="space-y-1">
              <Label className="text-xs">Cliente {type === 'credit' && <span className="text-destructive">*</span>}</Label>
              <Select
                value={customer_id || 'none'}
                onValueChange={v => {
                  if (v === 'none') { setCustomer(null, null); return }
                  const c = customers.find(c => c.id === v)
                  setCustomer(v, c?.name ?? null)
                }}
              >
                <SelectTrigger className="h-8 text-xs">
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

            {/* Método de pago (solo contado) */}
            {type === 'cash' && (
              <div className="space-y-1">
                <Label className="text-xs">Método de pago</Label>
                <Select value={payment_method} onValueChange={v => setPaymentMethod(v as typeof payment_method)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Descuento global */}
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Descuento global:</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                className="h-7 w-16 text-xs text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>

            {/* Flete (gasto empresa) */}
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Flete empresa:</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={freightCost || ''}
                onChange={e => setFreightCost(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="h-7 w-24 text-xs text-right"
              />
              <span className="text-xs text-muted-foreground">no se cobra</span>
            </div>

            {/* Notas colapsables */}
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="flex w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showNotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showNotes ? 'Ocultar notas' : 'Agregar nota'}
            </button>
            {showNotes && (
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Observaciones de la venta..."
                rows={2}
                className="w-full rounded-md border bg-transparent px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}

            <Separator />

            {/* Totales */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(itemsSubtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuento ({discount}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span>{taxLabel}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-12 rounded border bg-transparent px-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs">%</span>
                </div>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              {freightCost > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1 text-xs">
                    Flete
                    <span className="text-[10px] bg-muted rounded px-1">empresa</span>
                  </span>
                  <span className="text-xs">{formatCurrency(freightCost)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>TOTAL</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>

              {type === 'credit' && (
                <div className="space-y-2">
                  <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                    Se generará una cuenta por cobrar de <strong>{formatCurrency(total)}</strong>
                    {advanceAmount > 0 && (
                      <span className="block mt-0.5">Saldo pendiente: <strong>{formatCurrency(total - advanceAmount)}</strong></span>
                    )}
                  </div>
                  <div className="rounded-md border px-3 py-2.5 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Adelanto a cuenta (opcional)</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        max={total}
                        value={advanceAmount || ''}
                        onChange={e => setAdvanceAmount(Math.min(parseFloat(e.target.value) || 0, total))}
                        placeholder="0.00"
                        className="h-7 text-xs w-28 text-right"
                      />
                      <Select value={advanceMethod} onValueChange={v => setAdvanceMethod(v as typeof advanceMethod)}>
                        <SelectTrigger className="h-7 text-xs flex-1">
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Advertencia sin caja abierta */}
      {items.length > 0 && type === 'cash' && !openSession && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-400 shrink-0">
          Sin sesión de caja abierta — la venta se registrará pero no se reflejará en caja.
        </div>
      )}

      {/* Botón confirmar - siempre visible al fondo */}
      {items.length > 0 && (
        <Button
          className="w-full shrink-0"
          size="lg"
          onClick={handleConfirm}
          disabled={confirming || items.length === 0}
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {confirming ? 'Registrando...' : 'Confirmar y generar Nota de Pedido'}
        </Button>
      )}
    </div>
  )
}
