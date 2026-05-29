import { useState, useRef } from 'react'
import { Search, Package, Barcode } from 'lucide-react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { formatCurrency } from '@/shared/utils/currency'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useUnits } from '@/features/catalog/hooks/useUnits'
import { useCartStore } from '../store/cartStore'

export function ProductSearchPanel() {
  const { products } = useProducts()
  const { units } = useUnits()
  const unitMap = Object.fromEntries(units.map(u => [u.id, u.abbreviation]))
  const addItem = useCartStore(s => s.addItem)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = search.trim()
    ? products.filter(p =>
        p.is_active && (
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          (p.sku?.toLowerCase().includes(search.toLowerCase())) ||
          (p.barcode?.includes(search))
        )
      ).slice(0, 20)
    : products.filter(p => p.is_active).slice(0, 24)

  const handleAdd = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (!product) return
    addItem({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit_price: product.sale_price,
      quantity: 1,
      discount: 0,
      stock: product.stock,
    })
    setSearch('')
    inputRef.current?.focus()
  }

  // Búsqueda por Enter (código de barras)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const exact = products.find(
        p => p.barcode === search || p.sku === search
      )
      if (exact) { handleAdd(exact.id); return }
      if (filtered.length === 1) handleAdd(filtered[0].id)
    }
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Buscar por nombre, SKU o escanear código de barras..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-8"
          autoFocus
        />
        {search && (
          <Barcode className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Grid de productos */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {search ? 'Sin resultados' : 'No hay productos activos'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(p => (
              <button
                key={p.id}
                onClick={() => handleAdd(p.id)}
                className="group flex flex-col rounded-lg border overflow-hidden text-left hover:border-primary transition-colors"
              >
                {/* Imagen a pantalla completa del card */}
                <div className="aspect-square w-full overflow-hidden bg-muted">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-2 w-full min-w-0 bg-card group-hover:bg-primary/5 transition-colors">
                  <p className="truncate text-xs font-medium leading-tight">{p.name}</p>
                  {p.sku && (
                    <p className="truncate text-[10px] text-muted-foreground">{p.sku}</p>
                  )}
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <p className="text-sm font-bold text-primary">
                      {formatCurrency(p.sale_price)}
                    </p>
                    <span className={`text-[10px] font-medium tabular-nums ${
                      p.stock <= 0
                        ? 'text-destructive'
                        : p.stock <= p.min_stock && p.min_stock > 0
                          ? 'text-amber-500'
                          : 'text-muted-foreground'
                    }`}>
                      {p.stock <= 0
                        ? 'Sin stock'
                        : `${p.stock} ${p.unit_id ? (unitMap[p.unit_id] ?? 'uds') : 'uds'}`}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {products.filter(p => p.is_active).length} productos — Presiona Enter para agregar por código
      </p>
    </div>
  )
}
