import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DollarSign, ShoppingCart, CreditCard, Truck,
  AlertTriangle, TrendingUp, History, BarChart2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'
import { db } from '@/core/db/dexie'
import { useAuth } from '@/core/auth/useAuth'
import { useReceivables } from '@/features/receivables/hooks/useReceivables'
import { useSupplierPayments } from '@/features/supplier-payments/hooks/useSupplierPayments'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function toLocalDateStr(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DashboardPage() {
  const { orgId } = useAuth()
  const { load: loadReceivables } = useReceivables()
  const { load: loadPayables } = useSupplierPayments()

  useEffect(() => {
    loadReceivables()
    loadPayables()
  }, [orgId])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Ventas de hoy (confirmadas)
  const salesToday = useLiveQuery(
    () => orgId
      ? db.sales
          .where('org_id').equals(orgId)
          .filter(s => s.status === 'confirmed' && s.created_at >= todayISO)
          .toArray()
      : [],
    [orgId], []
  ) ?? []

  // Ventas del mes
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const salesMonth = useLiveQuery(
    () => orgId
      ? db.sales
          .where('org_id').equals(orgId)
          .filter(s => s.status === 'confirmed' && s.created_at >= firstOfMonth)
          .toArray()
      : [],
    [orgId], []
  ) ?? []

  // Cuentas por cobrar pendientes
  const pendingReceivables = useLiveQuery(
    () => orgId
      ? db.creditAccounts
          .where('org_id').equals(orgId)
          .filter(a => a.status !== 'paid')
          .toArray()
      : [],
    [orgId], []
  ) ?? []

  // Deudas a proveedores pendientes
  const pendingPayables = useLiveQuery(
    () => orgId
      ? db.supplierDebts
          .where('org_id').equals(orgId)
          .filter(d => d.status !== 'paid')
          .toArray()
      : [],
    [orgId], []
  ) ?? []

  // Productos con stock bajo
  const lowStockProducts = useLiveQuery(
    () => orgId
      ? db.products
          .where('org_id').equals(orgId)
          .filter(p => !p.deleted_at && p.is_active && p.min_stock > 0 && p.stock <= p.min_stock)
          .toArray()
      : [],
    [orgId], []
  ) ?? []

  // Últimas 5 ventas
  const recentSales = useLiveQuery(
    () => orgId
      ? db.sales
          .where('org_id').equals(orgId)
          .filter(s => s.status === 'confirmed')
          .toArray()
          .then(rows => rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5))
      : [],
    [orgId], []
  ) ?? []

  // Últimas 5 compras recibidas
  const recentPurchases = useLiveQuery(
    () => orgId
      ? db.purchaseOrders
          .where('org_id').equals(orgId)
          .filter(p => p.status === 'received')
          .toArray()
          .then(rows => rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3))
      : [],
    [orgId], []
  ) ?? []

  const todaySalesTotal = salesToday.reduce((s, v) => s + v.total, 0)
  const monthSalesTotal = salesMonth.reduce((s, v) => s + v.total, 0)
  const receivablesBalance = pendingReceivables.reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)
  const payablesBalance = pendingPayables.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)

  const overdueReceivables = pendingReceivables.filter(a => a.status === 'overdue').length
  const overduePayables = pendingPayables.filter(d => d.status === 'overdue').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">Resumen general del negocio</p>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ventas hoy"
          value={formatCurrency(todaySalesTotal)}
          sub={`${salesToday.length} ${salesToday.length === 1 ? 'venta' : 'ventas'}`}
          icon={DollarSign}
          variant="success"
        />
        <KpiCard
          title="Ventas del mes"
          value={formatCurrency(monthSalesTotal)}
          sub={`${salesMonth.length} ${salesMonth.length === 1 ? 'venta' : 'ventas'}`}
          icon={TrendingUp}
          variant="default"
        />
        <KpiCard
          title="Por cobrar"
          value={formatCurrency(receivablesBalance)}
          sub={overdueReceivables > 0 ? `${overdueReceivables} vencida${overdueReceivables > 1 ? 's' : ''}` : `${pendingReceivables.length} activa${pendingReceivables.length !== 1 ? 's' : ''}`}
          icon={CreditCard}
          variant={overdueReceivables > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          title="Por pagar (prov.)"
          value={formatCurrency(payablesBalance)}
          sub={overduePayables > 0 ? `${overduePayables} vencida${overduePayables > 1 ? 's' : ''}` : `${pendingPayables.length} activa${pendingPayables.length !== 1 ? 's' : ''}`}
          icon={Truck}
          variant={overduePayables > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Gráfico ventas vs gastos */}
      {orgId && <SalesExpensesChart orgId={orgId} />}

      {/* Fila inferior */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Stock bajo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock bajo ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin alertas de stock.</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1 mr-2">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`font-semibold tabular-nums ${p.stock <= 0 ? 'text-destructive' : 'text-amber-600'}`}>
                        {p.stock}
                      </span>
                      <span className="text-xs text-muted-foreground">/ {p.min_stock}</span>
                    </div>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <p className="text-xs text-muted-foreground">+{lowStockProducts.length - 5} más</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimas ventas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Últimas ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay ventas registradas.</p>
            ) : (
              <div className="space-y-2">
                {recentSales.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-xs font-medium">{s.series}-{String(s.number).padStart(4, '0')}</span>
                      <Badge
                        variant={s.type === 'credit' ? 'warning' : 'secondary'}
                        className="ml-2 text-[10px]"
                      >
                        {s.type === 'cash' ? 'Contado' : 'Crédito'}
                      </Badge>
                    </div>
                    <span className="font-semibold tabular-nums">{formatCurrency(s.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actividad reciente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 text-sm">
              {recentSales.slice(0, 2).map(s => (
                <div key={s.id} className="flex gap-2">
                  <Badge variant="success" className="text-[10px] shrink-0 mt-0.5">Venta</Badge>
                  <div>
                    <p className="leading-none">{formatCurrency(s.total)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(s.created_at)}</p>
                  </div>
                </div>
              ))}
              {recentPurchases.slice(0, 2).map(p => (
                <div key={p.id} className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">Compra</Badge>
                  <div>
                    <p className="leading-none">{formatCurrency(p.total)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</p>
                  </div>
                </div>
              ))}
              {recentSales.length === 0 && recentPurchases.length === 0 && (
                <div className="flex gap-2">
                  <Badge variant="success" className="text-[10px] shrink-0">Sistema</Badge>
                  <span className="text-muted-foreground">Configura tu empresa para comenzar</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SalesExpensesChart({ orgId }: { orgId: string }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear]   = useState(now.getFullYear())

  const startDate = new Date(year, month, 1).toISOString()
  const endDate   = new Date(year, month + 1, 1).toISOString()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const sales = useLiveQuery(
    () => db.sales
      .where('org_id').equals(orgId)
      .filter(s => s.status === 'confirmed' && s.created_at >= startDate && s.created_at < endDate)
      .toArray(),
    [orgId, year, month], []
  ) ?? []

  const supplierPayments = useLiveQuery(
    () => db.supplierPayments
      .where('org_id').equals(orgId)
      .filter(p => p.created_at >= startDate && p.created_at < endDate)
      .toArray(),
    [orgId, year, month], []
  ) ?? []

  const freightOrders = useLiveQuery(
    () => db.purchaseOrders
      .where('org_id').equals(orgId)
      .filter(o => o.status === 'received' && !!o.freight_cost && (o.freight_cost ?? 0) > 0 && o.updated_at >= startDate && o.updated_at < endDate)
      .toArray(),
    [orgId, year, month], []
  ) ?? []

  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    const ventas = sales
      .filter(s => toLocalDateStr(s.created_at) === dayStr)
      .reduce((sum, s) => sum + s.total, 0)

    const gastos =
      supplierPayments
        .filter(p => toLocalDateStr(p.created_at) === dayStr)
        .reduce((sum, p) => sum + p.amount, 0) +
      freightOrders
        .filter(o => toLocalDateStr(o.updated_at) === dayStr)
        .reduce((sum, o) => sum + (o.freight_cost ?? 0), 0)

    return { dia: day, Ventas: ventas, Gastos: gastos }
  })

  const totalVentas = data.reduce((s, d) => s + d.Ventas, 0)
  const totalGastos = data.reduce((s, d) => s + d.Gastos, 0)

  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Ventas vs Gastos — {MONTHS[month]} {year}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="h-7 text-xs w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-4 mt-1">
          <span className="text-xs text-emerald-600 font-medium">Ventas: {formatCurrency(totalVentas)}</span>
          <span className="text-xs text-red-600 font-medium">Gastos: {formatCurrency(totalGastos)}</span>
          <span className="text-xs text-muted-foreground font-medium">Margen: {formatCurrency(totalVentas - totalGastos)}</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              width={42}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatCurrency(value), name]}
              labelFormatter={d => `Día ${d}`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Ventas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
  variant = 'default',
}: {
  title: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'warning' | 'success'
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            {sub && <p className={`text-xs ${variant === 'warning' ? 'text-amber-600' : 'text-muted-foreground'}`}>{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 ${
            variant === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30'
            : variant === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30'
            : 'bg-primary/10'
          }`}>
            <Icon className={`h-5 w-5 ${
              variant === 'warning' ? 'text-amber-600 dark:text-amber-400'
              : variant === 'success' ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-primary'
            }`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
