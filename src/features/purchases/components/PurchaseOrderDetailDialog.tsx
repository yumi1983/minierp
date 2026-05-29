import { useEffect, useState } from 'react'
import { Loader2, Building2, Calendar, Hash, FileText, Package, Truck } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import { db } from '@/core/db/dexie'
import { usePurchaseOrders } from '../hooks/usePurchaseOrders'
import type { PurchaseOrderWithItems } from '../types'

const STATUS_CONFIG = {
  draft:     { label: 'Borrador',  variant: 'secondary' },
  sent:      { label: 'Enviada',   variant: 'default' },
  received:  { label: 'Recibida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
} as const

interface Props {
  orderId: string | null
  supplierName: string
  onClose: () => void
}

export function PurchaseOrderDetailDialog({ orderId, supplierName, onClose }: Props) {
  const { getWithItems } = usePurchaseOrders()
  const [order, setOrder] = useState<PurchaseOrderWithItems | null>(null)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!orderId) { setOrder(null); return }
    setLoading(true)
    getWithItems(orderId).then(async o => {
      setOrder(o)
      if (o) {
        const names: Record<string, string> = {}
        for (const item of o.items) {
          const p = await db.products.where('id').equals(item.product_id).first()
          if (p) names[item.product_id] = p.name
        }
        setProductNames(names)
      }
    }).finally(() => setLoading(false))
  }, [orderId])

  const statusCfg = order ? STATUS_CONFIG[order.status] : null
  const orderCode = order ? `${order.series}-${String(order.number).padStart(4, '0')}` : ''
  const taxRate = order && order.subtotal > 0
    ? Math.round((order.tax_amount / order.subtotal) * 100)
    : 0

  return (
    <Dialog open={!!orderId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Orden de Compra</span>
            {order && statusCfg && (
              <Badge variant={statusCfg.variant as 'default'}>{statusCfg.label}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : order ? (
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">

            {/* Cabecera: proveedor + datos del documento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Proveedor</p>
                    <p className="font-semibold">{supplierName}</p>
                  </div>
                </div>
                {order.notes && (
                  <div className="flex items-start gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Notas</p>
                      <p className="text-sm">{order.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">N° Orden</p>
                    <p className="font-mono font-bold text-base">{orderCode}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha emisión</p>
                    <p>{formatDate(order.issue_date ?? order.created_at)}</p>
                  </div>
                </div>
                {order.expected_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Fecha entrega esperada</p>
                      <p>{formatDate(order.expected_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Tabla de ítems */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">
                  Ítems ({order.items.length} {order.items.length === 1 ? 'producto' : 'productos'})
                </p>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Pedido</th>
                      {order.status === 'received' && (
                        <>
                          <th className="px-3 py-2 text-right text-xs font-medium text-emerald-600">Recibido</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-amber-600">Rechazado</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">P. Unit.</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                        {order.status === 'received' ? 'Subtotal recibido' : 'Subtotal'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {order.items.map((item, idx) => {
                      const isPartial = order.status === 'received' && item.received_quantity < item.quantity
                      const subtotalDisplay = order.status === 'received'
                        ? item.received_quantity * item.unit_price
                        : item.subtotal
                      return (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-3 py-2 text-muted-foreground text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">
                            {productNames[item.product_id] ?? (
                              <span className="text-muted-foreground text-xs italic">Producto eliminado</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                          {order.status === 'received' && (
                            <>
                              <td className={`px-3 py-2 text-right tabular-nums font-medium ${isPartial ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {item.received_quantity}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-destructive">
                                {item.rejected_quantity > 0 ? item.rejected_quantity : '—'}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(subtotalDisplay)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sección recepción */}
            {order.status === 'received' && (order.reception_notes || (order.freight_cost != null && order.freight_cost > 0)) && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                  <Truck className="h-4 w-4" />
                  Datos de recepción
                </div>
                {order.reception_notes && (
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground mb-0.5">Observaciones</p>
                    <p>{order.reception_notes}</p>
                  </div>
                )}
                {order.freight_cost != null && order.freight_cost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gasto de flete (empresa)</span>
                    <span className="tabular-nums font-medium text-blue-700 dark:text-blue-400">
                      {formatCurrency(order.freight_cost)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Totales */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal pedido</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.tax_amount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>IGV ({taxRate}%)</span>
                    <span className="tabular-nums">{formatCurrency(order.tax_amount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total pedido</span>
                  <span className="tabular-nums">{formatCurrency(order.total)}</span>
                </div>
                {order.status === 'received' && order.received_total != null && (
                  <>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total recibido</span>
                      <span className={`tabular-nums ${order.received_total < order.total ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatCurrency(order.received_total)}
                      </span>
                    </div>
                    {order.received_total < order.total && (
                      <p className="text-xs text-amber-600 text-right">
                        Recepción parcial ({Math.round((order.received_total / order.total) * 100)}% del pedido)
                      </p>
                    )}
                  </>
                )}
                {order.status !== 'received' && (
                  <div className="flex justify-between font-bold text-base">
                    <span>TOTAL</span>
                    <span className="tabular-nums text-primary">{formatCurrency(order.total)}</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No se encontró la orden.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
