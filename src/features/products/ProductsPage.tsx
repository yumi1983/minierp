import { useEffect, useState } from 'react'
import { Package, Plus, Search, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatCurrency } from '@/shared/utils/currency'
import { useProducts } from './hooks/useProducts'
import { useCategories } from '@/features/catalog/hooks/useCategories'
import { useBrands } from '@/features/catalog/hooks/useBrands'
import { useUnits } from '@/features/catalog/hooks/useUnits'
import { ProductForm } from './components/ProductForm'
import type { Product } from './types'
import type { ProductFormData } from './product.schema'

export function ProductsPage() {
  const { products, loading, load, create, update, remove, uploadImage } = useProducts()
  const { categories, load: loadCategories } = useCategories()
  const { brands, load: loadBrands } = useBrands()
  const { units, load: loadUnits } = useUnits()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    load()
    loadCategories()
    loadBrands()
    loadUnits()
  }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku?.toLowerCase().includes(search.toLowerCase())) ||
    (p.barcode?.toLowerCase().includes(search.toLowerCase()))
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true) }

  const handleSubmit = async (data: ProductFormData) => {
    if (editing) {
      await update(editing.id, {
        ...data,
        sku: data.sku || null,
        barcode: data.barcode || null,
        description: data.description || null,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        unit_id: data.unit_id || null,
        image_url: data.image_url ?? null,
      })
    } else {
      await create({
        ...data,
        sku: data.sku || null,
        barcode: data.barcode || null,
        description: data.description || null,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        unit_id: data.unit_id || null,
        image_url: data.image_url ?? null,
      })
    }
    setFormOpen(false)
  }

  const handleUploadImage = async (file: File): Promise<string> => {
    const tempId = editing?.id ?? crypto.randomUUID()
    return uploadImage(tempId, file)
  }

  const lowStock = products.filter(p => p.stock <= p.min_stock && p.min_stock > 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Productos</h2>
            <p className="text-sm text-muted-foreground">
              {products.length} producto{products.length !== 1 ? 's' : ''} registrado{products.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo producto
        </Button>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{lowStock.length}</strong> producto{lowStock.length !== 1 ? 's' : ''} con stock bajo:{' '}
            {lowStock.slice(0, 3).map(p => p.name).join(', ')}
            {lowStock.length > 3 && ` y ${lowStock.length - 3} más`}
          </span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, SKU o código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-12" />
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">SKU</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">P. Compra</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">P. Venta</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Estado</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && products.length === 0 ? (
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
                  {search ? 'Sin resultados' : 'No hay productos. Crea el primero.'}
                </td>
              </tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="h-9 w-9 rounded-md object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.barcode && <div className="text-xs text-muted-foreground">{p.barcode}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(p.purchase_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(p.sale_price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.stock <= p.min_stock && p.min_stock > 0
                      ? 'font-semibold text-amber-600 dark:text-amber-400' : 'tabular-nums'}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <Badge variant={p.is_active ? 'success' : 'secondary'}>
                      {p.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={8} className="px-4 py-2 text-xs text-muted-foreground">
                  {filtered.length} producto{filtered.length !== 1 ? 's' : ''}{search && ` de ${products.length}`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editing}
            categories={categories}
            brands={brands}
            units={units}
            onSubmit={handleSubmit}
            onUploadImage={handleUploadImage}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        title="¿Eliminar producto?"
        description="El producto se eliminará del sistema. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => { await remove(deleteId!); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

