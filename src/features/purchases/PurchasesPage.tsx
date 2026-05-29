import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, Search, Trash2, CheckCircle, Send, Pencil, FileDown, Banknote, Eye, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate } from '@/shared/utils/date'
import { usePurchaseOrders } from './hooks/usePurchaseOrders'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { useCompanyStore } from '@/features/company/store/company.store'
import { PurchaseOrderForm } from './components/PurchaseOrderForm'
import { ReceiveOrderDialog } from './components/ReceiveOrderDialog'
import { PurchaseOrderDetailDialog } from './components/PurchaseOrderDetailDialog'
import { generatePurchaseOrderPdf } from './utils/generatePurchaseOrderPdf'
import { db } from '@/core/db/dexie'
import type { PurchaseOrder, PurchaseOrderWithItems, ReceptionData } from './types'
import type { PurchaseOrderFormData } from './purchase.schema'

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  draft:     { label: 'Borrador',   variant: 'secondary' },
  sent:      { label: 'Enviada',    variant: 'default' },
  received:  { label: 'Recibida',   variant: 'success' },
  cancelled: { label: 'Cancelada',  variant: 'destructive' },
}

export function PurchasesPage() {
  const navigate = useNavigate()
  const { orders, loading, load, create, update, getWithItems, updateStatus, receive, remove } = usePurchaseOrders()
  const { suppliers, load: loadSuppliers } = useSuppliers()
  const companySettings = useCompanyStore(s => s.settings)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithItems | null>(null)
  const [receiveOrder, setReceiveOrder] = useState<PurchaseOrderWithItems | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  useEffect(() => { load(); loadSuppliers() }, [])

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]))

  const filtered = orders.filter(o =>
    (supplierMap[o.supplier_id] ?? '').toLowerCase().includes(search.toLowerCase()) ||
    `${o.series}-${o.number}`.includes(search)
  )

  const handleCreate = async (data: PurchaseOrderFormData) => {
    if (editingOrder) {
      await update(editingOrder.id, {
        supplier_id: data.supplier_id,
        issue_date: data.issue_date || null,
        expected_date: data.expected_date || null,
        notes: data.notes || null,
        tax_rate: data.tax_rate,
        items: data.items.map(i => ({
          id: i.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      })
      setEditingOrder(null)
    } else {
      await create({
        supplier_id: data.supplier_id,
        issue_date: data.issue_date || null,
        expected_date: data.expected_date || null,
        notes: data.notes || null,
        tax_rate: data.tax_rate,
        items: data.items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      })
    }
    setFormOpen(false)
  }

  const handleEdit = async (orderId: string) => {
    const order = await getWithItems(orderId)
    if (order) { setEditingOrder(order); setFormOpen(true) }
  }

  const handlePdf = async (orderId: string) => {
    const order = await getWithItems(orderId)
    if (!order) return
    const supplierName = supplierMap[order.supplier_id] ?? '—'
    const names: Record<string, string> = {}
    for (const item of order.items) {
      const p = await db.products.where('id').equals(item.product_id).first()
      if (p) names[item.product_id] = p.name
    }
    try {
      await generatePurchaseOrderPdf(order, names, supplierName, companySettings)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al generar PDF'
      toast.error(msg)
    }
  }

  const handleReceive = async (orderId: string) => {
    const order = await getWithItems(orderId)
    if (order) setReceiveOrder(order)
  }

  const orderCode = (o: PurchaseOrder) => `${o.series}-${String(o.number).padStart(4, '0')}`

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Compras</h2>
            <p className="text-sm text-muted-foreground">
              {orders.length} orden{orders.length !== 1 ? 'es' : ''} registrada{orders.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva orden
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por proveedor o número..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">N° Orden</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Proveedor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">F. Emisión</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">F. Entrega</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">T. Pedido</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">T. Recibido</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 w-32" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {search ? 'Sin resultados' : 'No hay órdenes. Crea la primera.'}
                </td>
              </tr>
            ) : (
              filtered.map(o => {
                const s = STATUS_LABELS[o.status]
                return (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-xs">{orderCode(o)}</td>
                    <td className="px-4 py-3 font-medium">{supplierMap[o.supplier_id] ?? '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{o.issue_date ? formatDate(o.issue_date) : formatDate(o.created_at)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {o.expected_date ? formatDate(o.expected_date) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(o.total)}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden lg:table-cell">
                      {o.status === 'received' && o.received_total != null
                        ? <span className={o.received_total < o.total ? 'text-amber-600 font-semibold' : 'text-emerald-600'}>
                            {formatCurrency(o.received_total)}
                          </span>
                        : <span className="text-muted-foreground">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={s.variant as 'default'}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Ver detalle"
                          onClick={() => setDetailId(o.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {o.status === 'draft' && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Editar orden"
                            onClick={() => handleEdit(o.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {o.status === 'draft' && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Marcar como enviada"
                            onClick={() => updateStatus(o.id, 'sent')}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {o.status === 'sent' && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Anular orden enviada"
                            onClick={() => setCancelId(o.id)}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(o.status === 'draft' || o.status === 'sent') && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            title="Recepcionar"
                            onClick={() => handleReceive(o.id)}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {o.status === 'received' && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            title="Ver/pagar deuda del proveedor"
                            onClick={() => navigate('/supplier-payments')}
                          >
                            <Banknote className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(o.status === 'sent' || o.status === 'received') && (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700"
                            title="Descargar PDF"
                            onClick={() => handlePdf(o.id)}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(o.status === 'draft') && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(o.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground">
                  {filtered.length} orden{filtered.length !== 1 ? 'es' : ''}
                  {search && ` de ${orders.length}`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Dialog nueva / editar OC */}
      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) setEditingOrder(null) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Editar orden de compra' : 'Nueva orden de compra'}</DialogTitle>
          </DialogHeader>
          <PurchaseOrderForm
            initialData={editingOrder ? {
              supplier_id: editingOrder.supplier_id,
              issue_date: editingOrder.issue_date ?? new Date().toISOString().split('T')[0],
              expected_date: editingOrder.expected_date,
              notes: editingOrder.notes,
              tax_rate: editingOrder.subtotal > 0
                ? Math.round((editingOrder.tax_amount / editingOrder.subtotal) * 100)
                : 0,
              items: editingOrder.items.map(i => ({
                id: i.id,
                product_id: i.product_id,
                quantity: i.quantity,
                unit_price: i.unit_price,
              })),
            } : undefined}
            onSubmit={handleCreate}
            onCancel={() => { setFormOpen(false); setEditingOrder(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog recepción */}
      <ReceiveOrderDialog
        open={!!receiveOrder}
        order={receiveOrder}
        onConfirm={(orderId: string, data: ReceptionData) => receive(orderId, data)}
        onClose={() => setReceiveOrder(null)}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="¿Eliminar orden de compra?"
        description="Se eliminará la orden. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => { await remove(deleteId!); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={!!cancelId}
        title="¿Anular orden de compra?"
        description="La orden pasará a estado Cancelada. No se puede revertir ni recepcionar después."
        confirmLabel="Anular orden"
        onConfirm={async () => { await updateStatus(cancelId!, 'cancelled'); setCancelId(null) }}
        onCancel={() => setCancelId(null)}
      />

      <PurchaseOrderDetailDialog
        orderId={detailId}
        supplierName={detailId ? (supplierMap[orders.find(o => o.id === detailId)?.supplier_id ?? ''] ?? '—') : '—'}
        onClose={() => setDetailId(null)}
      />
    </div>
  )
}

