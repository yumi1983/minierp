import { useEffect, useState } from 'react'
import { DollarSign, History, ShoppingCart, FileDown, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { useCompanyStore } from '@/features/company/store/company.store'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useCustomers } from '@/features/customers/hooks/useCustomers'
import { db } from '@/core/db/dexie'
import { ProductSearchPanel } from './components/ProductSearchPanel'
import { CartPanel } from './components/CartPanel'
import { useSales } from './hooks/useSales'
import { generateSaleNotePdf } from './utils/generateSaleNotePdf'
import type { Sale } from './types'

const TYPE_LABELS = { cash: 'Contado', credit: 'Crédito' }
const STATUS_VARIANTS = {
  confirmed: 'success',
  draft: 'secondary',
  cancelled: 'destructive',
} as const

export function SalesPage() {
  const { sales, loading, load, cancel, getWithItems } = useSales()
  const { load: loadProducts } = useProducts()
  const { load: loadCustomers, customers } = useCustomers()
  const companySettings = useCompanyStore(s => s.settings)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('pos')

  useEffect(() => {
    load()
    loadProducts()
    loadCustomers()
  }, [])

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c.name]))

  const saleCode = (s: Sale) => `${s.series}-${String(s.number).padStart(4, '0')}`

  const handlePdf = async (saleId: string) => {
    const sale = await getWithItems(saleId)
    if (!sale) return
    const names: Record<string, string> = {}
    for (const item of sale.items) {
      const p = await db.products.where('id').equals(item.product_id).first()
      if (p) names[item.product_id] = p.name
    }

    // Buscar adelanto si es venta a crédito
    let advanceAmount = 0
    let advanceMethod = ''
    if (sale.type === 'credit') {
      const creditAccount = await db.creditAccounts.where('sale_id').equals(saleId).first()
      if (creditAccount) {
        const advance = await db.creditPayments
          .where('credit_account_id').equals(creditAccount.id)
          .filter(p => p.notes === 'Adelanto al momento de la venta')
          .first()
        if (advance) {
          advanceAmount = advance.amount
          advanceMethod = advance.payment_method
        }
      }
    }

    try {
      await generateSaleNotePdf(
        sale,
        names,
        sale.customer_name ?? customerMap[sale.customer_id ?? ''] ?? null,
        companySettings,
        advanceAmount,
        advanceMethod,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar PDF')
    }
  }

  return (
    <div className="animate-fade-in h-auto lg:h-[calc(100vh-7rem)]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Ventas</h2>
              <p className="text-sm text-muted-foreground">POS y Notas de Pedido</p>
            </div>
          </div>
          <TabsList>
            <TabsTrigger value="pos" className="gap-1.5">
              <ShoppingCart className="h-4 w-4" />
              Punto de venta
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>
        </div>

        {/* POS */}
        <TabsContent value="pos" className="flex-1 overflow-auto lg:overflow-hidden mt-0">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_340px] lg:h-full">
            {/* Panel izquierdo: búsqueda de productos */}
            <div className="rounded-xl border bg-card p-4 overflow-hidden flex flex-col min-h-[380px] lg:min-h-0">
              <ProductSearchPanel />
            </div>

            {/* Panel derecho: carrito */}
            <div className="rounded-xl border bg-card p-4 overflow-hidden flex flex-col min-h-[480px] lg:min-h-0">
              <CartPanel onSaleConfirmed={() => setActiveTab('history')} />
            </div>
          </div>
        </TabsContent>

        {/* Historial */}
        <TabsContent value="history" className="flex-1 overflow-auto mt-0">
          <div className="rounded-lg border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">N° Nota</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Cargando...
                      </div>
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No hay ventas registradas. Usa el POS para crear la primera.
                    </td>
                  </tr>
                ) : (
                  sales.map(s => (
                    <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-medium">{saleCode(s)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {formatDateTime(s.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {s.customer_id ? (customerMap[s.customer_id] ?? '—') : (
                          <span className="text-muted-foreground">Sin cliente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <Badge variant={s.type === 'credit' ? 'warning' : 'secondary'}>
                          {TYPE_LABELS[s.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={STATUS_VARIANTS[s.status] as 'default'}>
                          {s.status === 'confirmed' ? 'Confirmada' : s.status === 'cancelled' ? 'Cancelada' : 'Borrador'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {s.status === 'confirmed' && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700"
                              title="Descargar Nota de Pedido"
                              onClick={() => handlePdf(s.id)}
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {s.status === 'confirmed' && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="Cancelar venta"
                              onClick={() => setCancelId(s.id)}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!cancelId}
        title="¿Cancelar venta?"
        description="Se marcará la venta como cancelada y el stock de cada producto se revertirá automáticamente."
        confirmLabel="Cancelar venta"
        onConfirm={async () => { await cancel(cancelId!); setCancelId(null) }}
        onCancel={() => setCancelId(null)}
      />
    </div>
  )
}

