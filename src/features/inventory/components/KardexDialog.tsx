import { useState, useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { formatDateTime } from '@/shared/utils/date'
import { formatCurrency } from '@/shared/utils/currency'
import { useInventory, type InventoryMovement } from '../hooks/useInventory'
import type { Product } from '@/features/products/types'

interface Props {
  product: Product | null
  onClose: () => void
}

const TYPE_LABELS: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJ: 'Ajuste',
  TRANSFER: 'Traslado',
}

const TYPE_VARIANTS: Record<string, string> = {
  IN: 'success',
  OUT: 'destructive',
  ADJ: 'secondary',
  TRANSFER: 'warning',
}

const REF_LABELS: Record<string, string> = {
  sale: 'Venta',
  purchase: 'Compra',
  adjustment: 'Ajuste manual',
}

export function KardexDialog({ product, onClose }: Props) {
  const { getByProduct } = useInventory()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!product) { setMovements([]); return }
    setLoading(true)
    getByProduct(product.id)
      .then(setMovements)
      .finally(() => setLoading(false))
  }, [product?.id])

  // Recalcula stock_before y stock_after desde el stock actual como fuente de verdad,
  // ignorando los valores almacenados que pueden ser incorrectos por race conditions.
  const correctedMovements = useMemo(() => {
    if (!product || movements.length === 0) return movements

    // Ordenar cronológicamente (más antiguo primero)
    const sorted = [...movements].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Cambio neto de todos los movimientos IN/OUT
    const netChange = sorted.reduce((s, m) => {
      if (m.type === 'IN') return s + m.quantity
      if (m.type === 'OUT') return s - m.quantity
      return s // ADJ/TRANSFER: se calcula por su propio delta
    }, 0)

    // Stock inicial = stock actual menos todo lo que entró/salió
    let running = product.stock - netChange

    const result = sorted.map(m => {
      const stock_before = running
      let stock_after: number
      if (m.type === 'IN') {
        stock_after = running + m.quantity
      } else if (m.type === 'OUT') {
        stock_after = running - m.quantity
      } else {
        // ADJ/TRANSFER: respetar el delta almacenado
        stock_after = stock_before + (m.stock_after - m.stock_before)
      }
      running = stock_after
      return { ...m, stock_before, stock_after }
    })

    return result // mostrar más antiguo primero (ascendente)
  }, [movements, product?.stock, product?.id])

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Kardex — {product?.name ?? ''}
          </DialogTitle>
          {product && (
            <p className="text-xs text-muted-foreground">
              Stock actual: <span className="font-semibold">{product.stock}</span>
              {product.sku && <span className="ml-3">SKU: {product.sku}</span>}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : correctedMovements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay movimientos registrados para este producto.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Fecha</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Referencia</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Stock ant.</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Stock desp.</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {correctedMovements.map(m => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge variant={TYPE_VARIANTS[m.type] as 'default'} className="text-[10px]">
                        {TYPE_LABELS[m.type] ?? m.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">
                      {m.reference_type ? (REF_LABELS[m.reference_type] ?? m.reference_type) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-medium text-sm ${
                      m.type === 'IN' ? 'text-emerald-600' : m.type === 'OUT' ? 'text-destructive' : 'text-blue-600'
                    }`}>
                      {m.type === 'IN' ? '+' : m.type === 'OUT' ? '-' : '='}{m.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden sm:table-cell tabular-nums">
                      {m.stock_before}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">
                      {m.stock_after}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
