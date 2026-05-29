import { useEffect, useState } from 'react'
import { Truck, AlertTriangle, TrendingDown, Clock, CheckCircle2, History, ImageIcon, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Dialog, DialogContent } from '@/shared/components/ui/dialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { usePurchaseOrders } from '@/features/purchases/hooks/usePurchaseOrders'
import { db } from '@/core/db/dexie'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useSupplierPayments } from './hooks/useSupplierPayments'
import { SupplierPaymentDialog } from './components/SupplierPaymentDialog'
import type { SupplierDebt, SupplierPaymentHistoryEntry } from './types'

const STATUS_LABELS = { active: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
const STATUS_VARIANTS = { active: 'warning', paid: 'success', overdue: 'destructive' } as const

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  check: 'Cheque',
}

export function SupplierPaymentsPage() {
  const { debts, paymentHistory, loading, load, removePayment, updateOverdueStatuses } = useSupplierPayments()
  const { load: loadSuppliers, suppliers } = useSuppliers()
  const { load: loadPurchaseOrders } = usePurchaseOrders()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'overdue' | 'paid'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [orderCodes, setOrderCodes] = useState<Record<string, string>>({})
  const [historySearch, setHistorySearch] = useState('')
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      await Promise.all([load(), loadSuppliers(), loadPurchaseOrders()])
      await updateOverdueStatuses()
    }
    init()
  }, [])

  // Cargar códigos de OC para mostrar en la tabla
  useEffect(() => {
    if (debts.length === 0) return
    const ids = debts.map(d => d.purchase_order_id).filter(Boolean) as string[]
    if (ids.length === 0) return
    Promise.all(ids.map(id => db.purchaseOrders.where('id').equals(id).first())).then(orders => {
      const map: Record<string, string> = {}
      orders.forEach((o, i) => {
        if (o) map[ids[i]] = `${o.series}-${String(o.number).padStart(4, '0')}`
      })
      setOrderCodes(map)
    })
  }, [debts])

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]))

  const filtered = debts.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false
    if (search) {
      const name = supplierMap[d.supplier_id]?.toLowerCase() ?? ''
      if (!name.includes(search.toLowerCase())) return false
    }
    return true
  })

  const totalPending = debts.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const totalOverdue = debts.filter(d => d.status === 'overdue').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
  const countActive = debts.filter(d => d.status === 'active').length
  const countOverdue = debts.filter(d => d.status === 'overdue').length

  const filteredHistory = paymentHistory.filter(p =>
    !historySearch || p.supplier_name.toLowerCase().includes(historySearch.toLowerCase())
  )

  // Agrupar historial por orden de compra
  const historyByOrder = filteredHistory.reduce<Record<string, SupplierPaymentHistoryEntry[]>>((acc, p) => {
    const key = p.order_code
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Truck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Pagos a Proveedores</h2>
          <p className="text-sm text-muted-foreground">Control de deudas y pagos</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Por pagar" value={formatCurrency(totalPending)} icon={<Clock className="h-4 w-4 text-amber-500" />} bg="bg-amber-50 dark:bg-amber-900/20" />
        <KpiCard label="Vencido" value={formatCurrency(totalOverdue)} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} bg="bg-red-50 dark:bg-red-900/20" />
        <KpiCard label="Deudas activas" value={String(countActive)} icon={<TrendingDown className="h-4 w-4 text-blue-500" />} bg="bg-blue-50 dark:bg-blue-900/20" />
        <KpiCard label="Deudas vencidas" value={String(countOverdue)} icon={<CheckCircle2 className="h-4 w-4 text-destructive" />} bg="bg-red-50 dark:bg-red-900/20" />
      </div>

      <Tabs defaultValue="debts">
        <TabsList>
          <TabsTrigger value="debts" className="gap-1.5">
            <Truck className="h-4 w-4" />
            Deudas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Historial de pagos
          </TabsTrigger>
        </TabsList>

        {/* Tab: Deudas */}
        <TabsContent value="debts" className="space-y-4 mt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Buscar proveedor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-56 text-sm"
            />
            <div className="flex gap-1">
              {(['all', 'active', 'overdue', 'paid'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {s === 'all' ? 'Todos' : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Proveedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">OC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Vence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && debts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Cargando...
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {debts.length === 0
                        ? 'No hay deudas registradas. Se generan al recibir órdenes de compra.'
                        : 'Sin resultados para los filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <DebtRow
                      key={d.id}
                      debt={d}
                      supplierName={supplierMap[d.supplier_id] ?? '—'}
                      orderCode={d.purchase_order_id ? (orderCodes[d.purchase_order_id] ?? '...') : '—'}
                      onPay={() => setSelectedId(d.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab: Historial por proveedor */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Input
            placeholder="Buscar proveedor..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            className="h-8 w-56 text-sm"
          />

          {Object.keys(historyByOrder).length === 0 ? (
            <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
              No hay pagos registrados aún.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(historyByOrder).map(([orderCode, payments]) => {
                const totalPagado = payments.reduce((s, p) => s + p.amount, 0)
                const supplierName = payments[0]?.supplier_name ?? '—'
                return (
                  <div key={orderCode} className="rounded-lg border overflow-hidden">
                    {/* Encabezado de la OC */}
                    <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-semibold">{orderCode}</span>
                        <span className="text-sm text-muted-foreground">{supplierName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {payments.length} pago{payments.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(totalPagado)}</span>
                    </div>

                    {/* Detalle de pagos */}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Método</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Referencia</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground w-14">Voucher</th>
                          <th className="px-4 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(p.created_at)}
                            </td>
                            <td className="px-4 py-2.5 text-xs">
                              {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                              {p.reference ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-600">
                              {formatCurrency(p.amount)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {p.voucher_url ? (
                                <button
                                  onClick={() => setVoucherUrl(p.voucher_url!)}
                                  title="Ver voucher"
                                  className="inline-flex items-center justify-center rounded-md p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                  <ImageIcon className="h-4 w-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => setDeletePaymentId(p.id)}
                                title="Eliminar pago"
                                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SupplierPaymentDialog debtId={selectedId} onClose={() => setSelectedId(null)} />

      <ConfirmDialog
        open={!!deletePaymentId}
        title="¿Eliminar pago?"
        description="Se eliminará el pago permanentemente de Supabase, incluyendo el voucher si existe. La deuda quedará con el saldo anterior. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          try {
            await removePayment(deletePaymentId!)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al eliminar el pago'
            toast.error(msg)
          } finally {
            setDeletePaymentId(null)
          }
        }}
        onCancel={() => setDeletePaymentId(null)}
      />

      {/* Lightbox voucher */}
      <Dialog open={!!voucherUrl} onOpenChange={open => !open && setVoucherUrl(null)}>
        <DialogContent className="max-w-2xl p-2">
          <div className="relative">
            <button
              onClick={() => setVoucherUrl(null)}
              className="absolute -top-1 -right-1 z-10 rounded-full bg-background border p-1 shadow"
            >
              <X className="h-4 w-4" />
            </button>
            {voucherUrl && (
              <img
                src={voucherUrl}
                alt="Voucher de pago"
                className="w-full rounded-lg object-contain max-h-[80vh]"
              />
            )}
          </div>
          <div className="flex justify-end pt-1">
            <a
              href={voucherUrl ?? ''}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              Abrir en nueva pestaña
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DebtRow({
  debt,
  supplierName,
  orderCode,
  onPay,
}: {
  debt: SupplierDebt
  supplierName: string
  orderCode: string
  onPay: () => void
}) {
  const balance = debt.total_amount - debt.paid_amount
  const isOverdue = debt.status === 'overdue'
  return (
    <tr className={`hover:bg-muted/30 transition-colors ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          {supplierName}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell font-mono text-xs text-muted-foreground">{orderCode}</td>
      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{formatDate(debt.created_at)}</td>
      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(debt.total_amount)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(debt.paid_amount)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-destructive">{formatCurrency(balance)}</td>
      <td className="px-4 py-3 text-center hidden sm:table-cell text-xs text-muted-foreground">
        {debt.due_date ? formatDate(debt.due_date) : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant={STATUS_VARIANTS[debt.status] as 'default'}>{STATUS_LABELS[debt.status]}</Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {debt.status !== 'paid' && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onPay}>
            Pagar
          </Button>
        )}
      </td>
    </tr>
  )
}

function KpiCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string
  value: string
  icon: React.ReactNode
  bg: string
}) {
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {icon}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}
