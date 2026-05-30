import { useState, useEffect } from 'react'
import { CheckCircle, Package, Loader2, AlertTriangle, XCircle, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Separator } from '@/shared/components/ui/separator'
import { formatCurrency } from '@/shared/utils/currency'
import { db } from '@/core/db/dexie'
import type { PurchaseOrderWithItems, ReceptionData } from '../types'

interface Props {
  open: boolean
  order: PurchaseOrderWithItems | null
  onConfirm: (orderId: string, data: ReceptionData) => Promise<void>
  onClose: () => void
}

interface RowState {
  received: string
  rejected: string
}

export function ReceiveOrderDialog({ open, order, onConfirm, onClose }: Props) {
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [freightCost, setFreightCost] = useState('0')
  const [receptionNotes, setReceptionNotes] = useState('')
  const [receptionDate, setReceptionDate] = useState(() => new Date().toISOString().split('T')[0])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!order?.items.length) return
    const loadNames = async () => {
      const names: Record<string, string> = {}
      for (const item of order.items) {
        const p = await db.products.where('id').equals(item.product_id).first()
        if (p) names[item.product_id] = p.name
      }
      setProductNames(names)
    }
    loadNames()
  }, [order])

  useEffect(() => {
    if (!order) return
    const initial: Record<string, RowState> = {}
    for (const item of order.items) {
      initial[item.id] = { received: String(item.quantity), rejected: '0' }
    }
    setRows(initial)
    setFreightCost('0')
    setReceptionNotes('')
    setReceptionDate(new Date().toISOString().split('T')[0])
    setFieldErrors({})
  }, [order])

  const clearItemErrors = (itemId: string) => {
    setFieldErrors(prev => {
      const next = { ...prev }
      delete next[`${itemId}_received`]
      delete next[`${itemId}_rejected`]
      delete next[`${itemId}_sum`]
      return next
    })
  }

  const handleReceivedChange = (itemId: string, value: string) => {
    const item = order?.items.find(i => i.id === itemId)
    if (!item) return
    const receivedNum = parseFloat(value)
    const autoRejected = !isNaN(receivedNum) && receivedNum >= 0
      ? Math.max(0, item.quantity - receivedNum)
      : 0
    setRows(prev => ({
      ...prev,
      [itemId]: {
        received: value,
        rejected: String(autoRejected),
      },
    }))
    clearItemErrors(itemId)
  }

  const handleRejectedChange = (itemId: string, value: string) => {
    setRows(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], rejected: value },
    }))
    clearItemErrors(itemId)
  }

  const validate = (): boolean => {
    if (!order) return false
    const errors: Record<string, string> = {}

    for (const item of order.items) {
      const row = rows[item.id]
      if (!row) continue
      const received = parseFloat(row.received) || 0
      const rejected = parseFloat(row.rejected) || 0

      if (received < 0) errors[`${item.id}_received`] = 'No puede ser negativo'
      if (rejected < 0) errors[`${item.id}_rejected`] = 'No puede ser negativo'
      if (received > item.quantity) errors[`${item.id}_received`] = `Máximo ${item.quantity}`
      if (rejected > item.quantity) errors[`${item.id}_rejected`] = `Máximo ${item.quantity}`
      if (received + rejected > item.quantity) {
        errors[`${item.id}_sum`] = `Recibido (${received}) + Rechazado (${rejected}) supera la cantidad pedida (${item.quantity})`
      }
    }

    const freight = parseFloat(freightCost) || 0
    if (freight < 0) errors['freight'] = 'El flete no puede ser negativo'

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleConfirm = async () => {
    if (!order) return
    if (!validate()) return

    const allZeroReceived = order.items.every(item => {
      const row = rows[item.id]
      return !row || (parseFloat(row.received) || 0) === 0
    })
    if (allZeroReceived) {
      const confirmed = window.confirm(
        'No hay productos con cantidad recibida. ¿Confirmar recepción con todo rechazado?'
      )
      if (!confirmed) return
    }

    setLoading(true)
    try {
      const receptionData: ReceptionData = {
        items: order.items.map(item => ({
          item_id: item.id,
          received_qty: parseFloat(rows[item.id]?.received || '0') || 0,
          rejected_qty: parseFloat(rows[item.id]?.rejected || '0') || 0,
        })),
        freight_cost: parseFloat(freightCost) || 0,
        notes: receptionNotes.trim(),
        reception_date: receptionDate,
      }
      await onConfirm(order.id, receptionData)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al recepcionar'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!order) return null

  const taxFactor = order.subtotal > 0 ? order.tax_amount / order.subtotal : 0
  let receivedSubtotal = 0
  let rejectedSubtotal = 0

  for (const item of order.items) {
    const row = rows[item.id]
    receivedSubtotal += (parseFloat(row?.received || '0') || 0) * item.unit_price
    rejectedSubtotal += (parseFloat(row?.rejected || '0') || 0) * item.unit_price
  }

  const freight = parseFloat(freightCost) || 0
  const receivedWithTax = receivedSubtotal * (1 + taxFactor)
  // El flete es gasto de empresa, NO suma a la deuda del proveedor
  const totalDebt = receivedWithTax

  const hasPartial = order.items.some(item => {
    const row = rows[item.id]
    const received = parseFloat(row?.received || '0') || 0
    const rejected = parseFloat(row?.rejected || '0') || 0
    return received + rejected < item.quantity
  })
  const hasRejected = rejectedSubtotal > 0

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Recepcionar orden de compra
          </DialogTitle>
          <DialogDescription>
            Ingresa las cantidades recibidas. La cantidad rechazada se calcula automáticamente por diferencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Fecha de recepción */}
          <div className="flex items-center gap-3">
            <div className="space-y-1.5 w-48">
              <Label htmlFor="reception-date" className="text-xs">Fecha de recepción *</Label>
              <Input
                id="reception-date"
                type="date"
                value={receptionDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setReceptionDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-5">
              Se usará como fecha de los movimientos de inventario en el Kardex.
            </p>
          </div>

          {/* Tabla de ítems */}
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Pedido</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-36">
                    <span className="text-emerald-600">Recibido</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-36">
                    <span className="text-destructive">Rechazado</span>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map(item => {
                  const row = rows[item.id] ?? { received: '0', rejected: '0' }
                  const received = parseFloat(row.received) || 0
                  const rejected = parseFloat(row.rejected) || 0
                  const pending = item.quantity - received - rejected
                  const lineSubtotal = received * item.unit_price

                  const receivedError = fieldErrors[`${item.id}_received`]
                  const rejectedError = fieldErrors[`${item.id}_rejected`]
                  const sumError = fieldErrors[`${item.id}_sum`]
                  const hasError = !!(receivedError || rejectedError || sumError)

                  return (
                    <tr key={item.id} className={hasError ? 'bg-destructive/5' : ''}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-xs leading-tight">
                            {productNames[item.product_id] ?? 'Cargando...'}
                          </span>
                        </div>
                        <div className="ml-5 mt-0.5 space-y-0.5">
                          {pending > 0 && !hasError && (
                            <p className="text-[10px] text-amber-600">{pending} sin registrar</p>
                          )}
                          {sumError && (
                            <p className="text-[10px] text-destructive">{sumError}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                        {item.quantity}
                      </td>

                      {/* Recibido — auto-calcula rechazado al cambiar */}
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="0.001"
                            value={row.received}
                            onChange={e => handleReceivedChange(item.id, e.target.value)}
                            className={`h-7 text-xs text-right tabular-nums ${receivedError ? 'border-destructive' : 'border-emerald-300 focus-visible:ring-emerald-400'}`}
                          />
                          {receivedError && (
                            <p className="text-[10px] text-destructive">{receivedError}</p>
                          )}
                        </div>
                      </td>

                      {/* Rechazado — editable manualmente */}
                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="0.001"
                            value={row.rejected}
                            onChange={e => handleRejectedChange(item.id, e.target.value)}
                            className={`h-7 text-xs text-right tabular-nums ${rejectedError ? 'border-destructive' : 'border-red-300 focus-visible:ring-red-400'}`}
                          />
                          {rejectedError && (
                            <p className="text-[10px] text-destructive">{rejectedError}</p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                        {formatCurrency(lineSubtotal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Flete y resumen */}
          <div className="grid gap-3 sm:grid-cols-2 items-start">
            {/* Deuda al proveedor */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Deuda al proveedor</p>
              <div className="flex justify-between text-muted-foreground">
                <span>Mercadería recibida</span>
                <span className="tabular-nums">{formatCurrency(receivedSubtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Impuesto ({Math.round(taxFactor * 100)}%)</span>
                <span className="tabular-nums">{formatCurrency(receivedSubtotal * taxFactor)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total deuda</span>
                <span className="tabular-nums text-amber-700 dark:text-amber-400">{formatCurrency(totalDebt)}</span>
              </div>
            </div>

            {/* Flete — gasto de empresa */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800 p-3 space-y-2 text-sm">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" />
                Gasto de empresa
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="freight" className="text-xs text-muted-foreground">Costo de flete</Label>
                <Input
                  id="freight"
                  type="number"
                  min="0"
                  step="0.01"
                  value={freightCost}
                  onChange={e => {
                    setFreightCost(e.target.value)
                    setFieldErrors(prev => { const n = { ...prev }; delete n['freight']; return n })
                  }}
                  className={`h-8 text-right tabular-nums text-sm ${fieldErrors['freight'] ? 'border-destructive' : ''}`}
                  placeholder="0.00"
                />
                {fieldErrors['freight'] && (
                  <p className="text-xs text-destructive">{fieldErrors['freight']}</p>
                )}
              </div>
              {freight > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Se registrará {formatCurrency(freight)} como gasto de flete de la empresa.
                </p>
              )}
            </div>
          </div>

          {/* Alertas */}
          {(hasRejected || hasPartial) && (
            <div className="flex flex-wrap gap-2">
              {hasRejected && (
                <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  Rechazado: {formatCurrency(rejectedSubtotal)} (sin impuesto) — no genera deuda
                </div>
              )}
              {hasPartial && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Hay unidades sin registrar (ni recibidas ni rechazadas)
                </div>
              )}
            </div>
          )}

          {/* Observaciones */}
          <div className="space-y-1.5">
            <Label htmlFor="reception-notes">Observaciones de recepción</Label>
            <Textarea
              id="reception-notes"
              placeholder="Ej: 3 unidades llegaron con embalaje dañado, se rechazaron..."
              value={receptionNotes}
              onChange={e => setReceptionNotes(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CheckCircle className="h-4 w-4" />
            }
            Confirmar recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
