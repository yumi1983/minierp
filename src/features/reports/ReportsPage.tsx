import { useState, useEffect } from 'react'
import { BarChart3, FileDown, FileSpreadsheet, DollarSign, ShoppingCart, Warehouse, CreditCard, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { db } from '@/core/db/dexie'
import { useAuth } from '@/core/auth/useAuth'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { useSuppliers } from '@/features/suppliers/hooks/useSuppliers'
import { useProducts } from '@/features/products/hooks/useProducts'
import type { Product } from '@/features/products/types'
import type { LocalSale, LocalPurchaseOrder, LocalCreditAccount, LocalSupplierDebt } from '@/core/db/dexie'

function getDefaultRange() {
  const today = new Date()
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  return {
    from: first.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  }
}

export function ReportsPage() {
  const { orgId } = useAuth()
  const { customers, load: loadCustomers } = useCustomers()
  const { suppliers, load: loadSuppliers } = useSuppliers()
  const { products, load: loadProducts } = useProducts()
  const [range, setRange] = useState(getDefaultRange())
  const [tab, setTab] = useState('sales')

  // Report data
  const [sales, setSales] = useState<LocalSale[]>([])
  const [purchases, setPurchases] = useState<LocalPurchaseOrder[]>([])
  const [receivables, setReceivables] = useState<LocalCreditAccount[]>([])
  const [payables, setPayables] = useState<LocalSupplierDebt[]>([])
  const [inventory, setInventory] = useState<Product[]>([])
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    loadCustomers()
    loadSuppliers()
    loadProducts()
  }, [])

  useEffect(() => { fetchData() }, [tab, range.from, range.to, orgId])

  const fetchData = async () => {
    if (!orgId) return
    setLoadingReport(true)
    try {
      const fromISO = range.from + 'T00:00:00.000Z'
      const toISO = range.to + 'T23:59:59.999Z'

      if (tab === 'sales') {
        const rows = await db.sales.where('org_id').equals(orgId)
          .filter(s => s.status === 'confirmed' && s.created_at >= fromISO && s.created_at <= toISO)
          .toArray()
        // Dedup
        const seen = new Map<string, LocalSale>()
        for (const r of rows) { const p = seen.get(r.id); if (!p || (r._localId ?? 0) > (p._localId ?? 0)) seen.set(r.id, r) }
        setSales(Array.from(seen.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      } else if (tab === 'purchases') {
        const rows = await db.purchaseOrders.where('org_id').equals(orgId)
          .filter(p => !p.deleted_at && p.created_at >= fromISO && p.created_at <= toISO)
          .toArray()
        const seen = new Map<string, LocalPurchaseOrder>()
        for (const r of rows) { const p = seen.get(r.id); if (!p || (r._localId ?? 0) > (p._localId ?? 0)) seen.set(r.id, r) }
        setPurchases(Array.from(seen.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      } else if (tab === 'receivables') {
        const rows = await db.creditAccounts.where('org_id').equals(orgId).toArray()
        const seen = new Map<string, LocalCreditAccount>()
        for (const r of rows) { const p = seen.get(r.id); if (!p || (r._localId ?? 0) > (p._localId ?? 0)) seen.set(r.id, r) }
        setReceivables(Array.from(seen.values()))
      } else if (tab === 'payables') {
        const rows = await db.supplierDebts.where('org_id').equals(orgId).toArray()
        const seen = new Map<string, LocalSupplierDebt>()
        for (const r of rows) { const p = seen.get(r.id); if (!p || (r._localId ?? 0) > (p._localId ?? 0)) seen.set(r.id, r) }
        setPayables(Array.from(seen.values()))
      } else if (tab === 'inventory') {
        const rows = products.filter(p => !p.deleted_at && p.is_active)
        setInventory(rows)
      }
    } finally {
      setLoadingReport(false)
    }
  }

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]))
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s.name]))
  const productMap = Object.fromEntries(products.map(p => [p.id, p.name]))

  const handleExportPdf = async () => {
    try {
      const { generateReportPdf } = await import('./utils/generateReportPdf')
      await generateReportPdf({ tab, sales, purchases, receivables, payables, inventory, customerMap, supplierMap, productMap, range })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar PDF')
    }
  }

  const handleExportExcel = async () => {
    try {
      const { generateReportExcel } = await import('./utils/generateReportExcel')
      await generateReportExcel({ tab, sales, purchases, receivables, payables, inventory, customerMap, supplierMap, productMap, range })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar Excel')
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><BarChart3 className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Reportes</h2>
            <p className="text-sm text-muted-foreground">Consultas y exportaciones</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf}>
            <FileDown className="h-4 w-4" />PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4" />Excel
          </Button>
        </div>
      </div>

      {/* Filtro de fechas (no aplica para inventario) */}
      {tab !== 'inventory' && tab !== 'receivables' && tab !== 'payables' && (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Desde:</Label>
            <Input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className="h-8 w-36 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Hasta:</Label>
            <Input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className="h-8 w-36 text-sm" />
          </div>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="sales" className="gap-1.5 text-xs"><DollarSign className="h-3.5 w-3.5" />Ventas</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1.5 text-xs"><ShoppingCart className="h-3.5 w-3.5" />Compras</TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5 text-xs"><Warehouse className="h-3.5 w-3.5" />Inventario</TabsTrigger>
          <TabsTrigger value="receivables" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" />Por Cobrar</TabsTrigger>
          <TabsTrigger value="payables" className="gap-1.5 text-xs"><Truck className="h-3.5 w-3.5" />Por Pagar</TabsTrigger>
        </TabsList>

        {/* ── VENTAS ── */}
        <TabsContent value="sales" className="mt-4">
          <ReportSummary items={[
            { label: 'Total ventas', value: formatCurrency(sales.reduce((s, v) => s + v.total, 0)) },
            { label: 'N° ventas', value: String(sales.length) },
            { label: 'Contado', value: formatCurrency(sales.filter(v => v.type === 'cash').reduce((s, v) => s + v.total, 0)) },
            { label: 'Gasto flete', value: formatCurrency(sales.reduce((s, v) => s + (v.freight_cost ?? 0), 0)), highlight: true },
          ]} />
          <ReportTable loading={loadingReport}
            headers={['N° Nota', 'Fecha', 'Cliente', 'Tipo', 'Subtotal', 'IGV', 'Total', 'Flete']}
            rows={sales.map(s => [
              `${s.series}-${String(s.number).padStart(4, '0')}`,
              formatDateTime(s.created_at),
              s.customer_id ? (customerMap[s.customer_id] ?? '—') : 'Sin cliente',
              <Badge key="t" variant={s.type === 'credit' ? 'warning' : 'secondary'}>{s.type === 'cash' ? 'Contado' : 'Crédito'}</Badge>,
              formatCurrency(s.subtotal),
              formatCurrency(s.tax_amount),
              <span key="tot" className="font-semibold">{formatCurrency(s.total)}</span>,
              s.freight_cost ? <span key="fl" className="text-amber-600 tabular-nums">{formatCurrency(s.freight_cost)}</span> : '—',
            ])}
            emptyMsg="No hay ventas en el período seleccionado."
          />
        </TabsContent>

        {/* ── COMPRAS ── */}
        <TabsContent value="purchases" className="mt-4">
          <ReportSummary items={[
            { label: 'Total compras', value: formatCurrency(purchases.reduce((s, p) => s + p.total, 0)) },
            { label: 'N° órdenes', value: String(purchases.length) },
            { label: 'Recibidas', value: String(purchases.filter(p => p.status === 'received').length) },
            { label: 'Gasto flete', value: formatCurrency(purchases.reduce((s, p) => s + (p.freight_cost ?? 0), 0)), highlight: true },
          ]} />
          <ReportTable loading={loadingReport}
            headers={['N° OC', 'Fecha', 'Proveedor', 'Estado', 'Total', 'Flete']}
            rows={purchases.map(p => [
              `${p.series}-${String(p.number).padStart(4, '0')}`,
              formatDate(p.created_at),
              supplierMap[p.supplier_id] ?? '—',
              <Badge key="st" variant={p.status === 'received' ? 'success' : p.status === 'cancelled' ? 'destructive' : 'secondary'}>
                {p.status === 'draft' ? 'Borrador' : p.status === 'sent' ? 'Enviada' : p.status === 'received' ? 'Recibida' : 'Cancelada'}
              </Badge>,
              <span key="tot" className="font-semibold">{formatCurrency(p.total)}</span>,
              p.freight_cost ? <span key="fl" className="text-amber-600 tabular-nums">{formatCurrency(p.freight_cost)}</span> : '—',
            ])}
            emptyMsg="No hay órdenes de compra en el período seleccionado."
          />
        </TabsContent>

        {/* ── INVENTARIO ── */}
        <TabsContent value="inventory" className="mt-4">
          <ReportSummary items={[
            { label: 'Productos activos', value: String(inventory.length) },
            { label: 'Valor total (costo)', value: formatCurrency(inventory.reduce((s, p) => s + p.stock * p.purchase_price, 0)) },
            { label: 'Sin stock', value: String(inventory.filter(p => p.stock <= 0).length) },
            { label: 'Bajo mínimo', value: String(inventory.filter(p => p.min_stock > 0 && p.stock <= p.min_stock).length) },
          ]} />
          <ReportTable loading={loadingReport}
            headers={['SKU', 'Producto', 'Stock', 'Mínimo', 'P. Costo', 'P. Venta', 'Valor stock']}
            rows={inventory.map(p => [
              p.sku ?? '—',
              p.name,
              <span key="st" className={`font-semibold tabular-nums ${p.stock <= 0 ? 'text-destructive' : p.min_stock > 0 && p.stock <= p.min_stock ? 'text-amber-600' : ''}`}>{p.stock}</span>,
              p.min_stock > 0 ? p.min_stock : '—',
              formatCurrency(p.purchase_price),
              formatCurrency(p.sale_price),
              <span key="val" className="font-medium">{formatCurrency(p.stock * p.purchase_price)}</span>,
            ])}
            emptyMsg="No hay productos activos."
          />
        </TabsContent>

        {/* ── CUENTAS POR COBRAR ── */}
        <TabsContent value="receivables" className="mt-4">
          <ReportSummary items={[
            { label: 'Total por cobrar', value: formatCurrency(receivables.filter(a => a.status !== 'paid').reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)) },
            { label: 'Cuentas activas', value: String(receivables.filter(a => a.status === 'active').length) },
            { label: 'Vencidas', value: String(receivables.filter(a => a.status === 'overdue').length) },
            { label: 'Canceladas', value: String(receivables.filter(a => a.status === 'paid').length) },
          ]} />
          <ReportTable loading={loadingReport}
            headers={['Cliente', 'Fecha', 'Total', 'Cobrado', 'Saldo', 'Vence', 'Estado']}
            rows={receivables.map(a => [
              customerMap[a.customer_id] ?? '—',
              formatDate(a.created_at),
              formatCurrency(a.total_amount),
              formatCurrency(a.paid_amount),
              <span key="bal" className={`font-semibold tabular-nums ${a.status !== 'paid' ? 'text-destructive' : 'text-emerald-600'}`}>{formatCurrency(a.total_amount - a.paid_amount)}</span>,
              a.due_date ? formatDate(a.due_date) : '—',
              <Badge key="st" variant={a.status === 'paid' ? 'success' : a.status === 'overdue' ? 'destructive' : 'warning'}>
                {a.status === 'active' ? 'Pendiente' : a.status === 'overdue' ? 'Vencido' : 'Pagado'}
              </Badge>,
            ])}
            emptyMsg="No hay cuentas por cobrar."
          />
        </TabsContent>

        {/* ── CUENTAS POR PAGAR ── */}
        <TabsContent value="payables" className="mt-4">
          <ReportSummary items={[
            { label: 'Total por pagar', value: formatCurrency(payables.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)) },
            { label: 'Deudas activas', value: String(payables.filter(d => d.status === 'active').length) },
            { label: 'Vencidas', value: String(payables.filter(d => d.status === 'overdue').length) },
            { label: 'Canceladas', value: String(payables.filter(d => d.status === 'paid').length) },
          ]} />
          <ReportTable loading={loadingReport}
            headers={['Proveedor', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Vence', 'Estado']}
            rows={payables.map(d => [
              supplierMap[d.supplier_id] ?? '—',
              formatDate(d.created_at),
              formatCurrency(d.total_amount),
              formatCurrency(d.paid_amount),
              <span key="bal" className={`font-semibold tabular-nums ${d.status !== 'paid' ? 'text-destructive' : 'text-emerald-600'}`}>{formatCurrency(d.total_amount - d.paid_amount)}</span>,
              d.due_date ? formatDate(d.due_date) : '—',
              <Badge key="st" variant={d.status === 'paid' ? 'success' : d.status === 'overdue' ? 'destructive' : 'warning'}>
                {d.status === 'active' ? 'Pendiente' : d.status === 'overdue' ? 'Vencido' : 'Pagado'}
              </Badge>,
            ])}
            emptyMsg="No hay cuentas por pagar."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReportSummary({ items }: { items: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {items.map(item => (
        <div key={item.label} className={`rounded-xl border p-3 ${item.highlight ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-muted/30'}`}>
          <p className={`text-xs ${item.highlight ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{item.label}</p>
          <p className={`text-lg font-bold tabular-nums mt-0.5 ${item.highlight ? 'text-amber-700 dark:text-amber-300' : ''}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function ReportTable({ headers, rows, emptyMsg, loading }: {
  headers: string[]
  rows: (string | number | React.ReactNode)[][]
  emptyMsg: string
  loading: boolean
}) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {loading ? (
            <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-muted-foreground">
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Cargando...
              </div>
            </td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="px-4 py-10 text-center text-muted-foreground text-sm">{emptyMsg}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
