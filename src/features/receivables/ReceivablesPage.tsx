import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CreditCard, AlertTriangle, CheckCircle2, Clock, History, ImageIcon, X, Trash2 } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { useReceivables } from './hooks/useReceivables'
import { PaymentDialog } from './components/PaymentDialog'
import type { CreditAccount, PaymentHistoryEntry } from './types'

const STATUS_LABELS = { active: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' }
const STATUS_VARIANTS = {
  active: 'warning',
  paid: 'success',
  overdue: 'destructive',
} as const

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  check: 'Cheque',
}

export function ReceivablesPage() {
  const { accounts, paymentHistory, loading, load, updateOverdueStatuses, fixPaidStatuses, removePayment } = useReceivables()
  const { load: loadCustomers, customers } = useCustomers()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'overdue' | 'paid'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [historySearch, setHistorySearch] = useState('')
  const [voucherUrl, setVoucherUrl] = useState<string | null>(null)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      await Promise.all([load(), loadCustomers()])
      await fixPaidStatuses()
      await updateOverdueStatuses()
    }
    init()
  }, [])

  // Estado efectivo: si paid_amount >= total_amount es "paid" aunque el campo diga otra cosa
  const effectiveStatus = (a: CreditAccount): 'paid' | 'active' | 'overdue' => {
    if (Math.round(a.paid_amount * 100) >= Math.round(a.total_amount * 100)) return 'paid'
    return a.status
  }

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]))

  const filtered = accounts.filter(a => {
    const es = effectiveStatus(a)
    if (filterStatus !== 'all' && es !== filterStatus) return false
    if (search) {
      const name = customerMap[a.customer_id]?.toLowerCase() ?? ''
      if (!name.includes(search.toLowerCase())) return false
    }
    return true
  })

  const totalPending = accounts
    .filter(a => effectiveStatus(a) !== 'paid')
    .reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)
  const totalOverdue = accounts
    .filter(a => effectiveStatus(a) === 'overdue')
    .reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)
  const countActive = accounts.filter(a => effectiveStatus(a) === 'active').length
  const countOverdue = accounts.filter(a => effectiveStatus(a) === 'overdue').length

  const filteredHistory = paymentHistory.filter(p =>
    !historySearch || p.customer_name.toLowerCase().includes(historySearch.toLowerCase())
  )

  // Agrupar historial por cliente
  const historyByCustomer = filteredHistory.reduce<Record<string, PaymentHistoryEntry[]>>((acc, p) => {
    const key = p.customer_name
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <CreditCard className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Cuentas por Cobrar</h2>
          <p className="text-sm text-muted-foreground">Gestión de créditos y cobros</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Por cobrar"
          value={formatCurrency(totalPending)}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          bg="bg-amber-50 dark:bg-amber-900/20"
        />
        <KpiCard
          label="Vencido"
          value={formatCurrency(totalOverdue)}
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          bg="bg-red-50 dark:bg-red-900/20"
        />
        <KpiCard
          label="Cuentas activas"
          value={String(countActive)}
          icon={<CreditCard className="h-4 w-4 text-blue-500" />}
          bg="bg-blue-50 dark:bg-blue-900/20"
        />
        <KpiCard
          label="Cuentas vencidas"
          value={String(countOverdue)}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          bg="bg-emerald-50 dark:bg-emerald-900/20"
        />
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts" className="gap-1.5">
            <CreditCard className="h-4 w-4" />
            Cuentas
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            Historial de cobros
          </TabsTrigger>
        </TabsList>

        {/* Tab: Cuentas */}
        <TabsContent value="accounts" className="space-y-4 mt-4">
          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Buscar cliente..."
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
            <table className="w-full text-sm min-w-[580px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Saldo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Vence</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && accounts.length === 0 ? (
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
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      {accounts.length === 0
                        ? 'No hay cuentas por cobrar. Se generan automáticamente al confirmar ventas a crédito.'
                        : 'Sin resultados para los filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <AccountRow
                      key={a.id}
                      account={a}
                      customerName={customerMap[a.customer_id] ?? '—'}
                      onPay={() => setSelectedId(a.id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Tab: Historial por cliente */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <Input
            placeholder="Buscar cliente..."
            value={historySearch}
            onChange={e => setHistorySearch(e.target.value)}
            className="h-8 w-56 text-sm"
          />

          {Object.keys(historyByCustomer).length === 0 ? (
            <div className="rounded-lg border p-12 text-center text-sm text-muted-foreground">
              No hay cobros registrados aún.
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(historyByCustomer).map(([customerName, payments]) => {
                const totalPagado = payments.reduce((s, p) => s + p.amount, 0)
                return (
                  <div key={customerName} className="rounded-lg border overflow-hidden">
                    {/* Encabezado del cliente */}
                    <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{customerName}</span>
                        <Badge variant="secondary" className="text-xs">{payments.length} cobro{payments.length !== 1 ? 's' : ''}</Badge>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{formatCurrency(totalPagado)}</span>
                    </div>

                    {/* Detalle de pagos */}
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Nota Pedido</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Método</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Referencia</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Monto</th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground w-14">Voucher</th>
                          <th className="px-2 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payments.map(p => (
                          <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(p.created_at)}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs hidden sm:table-cell">{p.sale_code}</td>
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
                            <td className="px-2 py-2.5 text-center">
                              <button
                                onClick={() => setDeletePaymentId(p.id)}
                                title="Eliminar cobro"
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

      <PaymentDialog accountId={selectedId} onClose={() => setSelectedId(null)} />

      <ConfirmDialog
        open={!!deletePaymentId}
        title="¿Eliminar cobro?"
        description="Se eliminará el cobro permanentemente de Supabase, incluyendo el voucher si existe. La cuenta quedará con el saldo anterior. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          try { await removePayment(deletePaymentId!) }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Error al eliminar el cobro') }
          finally { setDeletePaymentId(null) }
        }}
        onCancel={() => setDeletePaymentId(null)}
      />

      {/* Lightbox voucher */}
      <Dialog open={!!voucherUrl} onOpenChange={open => !open && setVoucherUrl(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogTitle className="sr-only">Voucher de cobro</DialogTitle>
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
                alt="Voucher de cobro"
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

function AccountRow({
  account,
  customerName,
  onPay,
}: {
  account: CreditAccount
  customerName: string
  onPay: () => void
}) {
  const balance = account.total_amount - account.paid_amount
  const es: 'paid' | 'active' | 'overdue' =
    Math.round(account.paid_amount * 100) >= Math.round(account.total_amount * 100)
      ? 'paid'
      : account.status
  const isOverdue = es === 'overdue'

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          {customerName}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
        {formatDate(account.created_at)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(account.total_amount)}</td>
      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{formatCurrency(account.paid_amount)}</td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-destructive">
        {formatCurrency(balance)}
      </td>
      <td className="px-4 py-3 text-center hidden sm:table-cell text-xs text-muted-foreground">
        {account.due_date ? formatDate(account.due_date) : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant={STATUS_VARIANTS[es] as 'default'}>
          {STATUS_LABELS[es]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {es !== 'paid' && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onPay}
          >
            Cobrar
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
