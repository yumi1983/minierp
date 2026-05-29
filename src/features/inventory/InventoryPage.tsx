import { useEffect, useState } from 'react'
import { Warehouse, AlertTriangle, Plus, History, ArrowUpDown } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { formatCurrency } from '@/shared/utils/currency'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useInventory } from './hooks/useInventory'
import { AdjustmentDialog } from './components/AdjustmentDialog'
import { KardexDialog } from './components/KardexDialog'
import type { Product } from '@/features/products/types'

export function InventoryPage() {
  const { products, load: loadProducts } = useProducts()
  const { load: loadMovements } = useInventory()
  const [search, setSearch] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [kardexProduct, setKardexProduct] = useState<Product | null>(null)

  useEffect(() => {
    loadProducts()
    loadMovements()
  }, [])

  const activeProducts = products.filter(p => !p.deleted_at && p.is_active)

  const filtered = activeProducts.filter(p => {
    if (filterLow && p.stock > p.min_stock) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.sku ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowStockCount = activeProducts.filter(p => p.min_stock > 0 && p.stock <= p.min_stock).length
  const zeroStockCount = activeProducts.filter(p => p.stock <= 0).length
  const totalValue = activeProducts.reduce((s, p) => s + p.stock * p.purchase_price, 0)

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Warehouse className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Inventario</h2>
            <p className="text-sm text-muted-foreground">Kardex y movimientos de stock</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Valor del inventario</p>
            <ArrowUpDown className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold tabular-nums">{formatCurrency(totalValue)}</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Stock bajo mínimo</p>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold tabular-nums">{lowStockCount}</p>
        </div>
        <div className="rounded-xl border p-4 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-muted-foreground">Sin stock</p>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-xl font-bold tabular-nums">{zeroStockCount}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar producto o SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 w-64 text-sm"
        />
        <button
          onClick={() => setFilterLow(!filterLow)}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5 ${
            filterLow
              ? 'bg-amber-500 text-white border-amber-500'
              : 'hover:bg-accent text-muted-foreground'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          Solo stock bajo
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Mínimo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">P. Compra</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">P. Venta</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {activeProducts.length === 0
                    ? 'No hay productos activos en el inventario.'
                    : 'Sin resultados para los filtros aplicados.'}
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <ProductRow
                  key={p.id}
                  product={p}
                  onAdjust={() => setAdjustProduct(p)}
                  onKardex={() => setKardexProduct(p)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdjustmentDialog
        product={adjustProduct}
        onClose={() => setAdjustProduct(null)}
      />
      <KardexDialog
        product={kardexProduct}
        onClose={() => setKardexProduct(null)}
      />
    </div>
  )
}

function ProductRow({
  product,
  onAdjust,
  onKardex,
}: {
  product: Product
  onAdjust: () => void
  onKardex: () => void
}) {
  const isLow = product.min_stock > 0 && product.stock <= product.min_stock
  const isZero = product.stock <= 0

  const stockStatus = isZero ? 'destructive' : isLow ? 'warning' : 'success'
  const statusLabel = isZero ? 'Sin stock' : isLow ? 'Stock bajo' : 'OK'

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${isZero ? 'bg-red-50/30 dark:bg-red-900/10' : isLow ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
      <td className="px-4 py-3 font-medium">
        <div className="flex items-center gap-2">
          {(isLow || isZero) && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isZero ? 'text-destructive' : 'text-amber-500'}`} />}
          {product.name}
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs font-mono text-muted-foreground">
        {product.sku ?? '—'}
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-semibold text-lg">
        {product.stock}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground text-xs hidden sm:table-cell">
        {product.min_stock > 0 ? product.min_stock : '—'}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs hidden lg:table-cell">
        {formatCurrency(product.purchase_price)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs hidden lg:table-cell">
        {formatCurrency(product.sale_price)}
      </td>
      <td className="px-4 py-3 text-center">
        <Badge variant={stockStatus as 'default'}>{statusLabel}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Ver Kardex"
            onClick={onKardex}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary hover:text-primary"
            title="Registrar movimiento"
            onClick={onAdjust}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
