import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { useInventory, type MovementType } from '../hooks/useInventory'
import type { Product } from '@/features/products/types'

interface Props {
  product: Product | null
  onClose: () => void
}

const TYPE_CONFIG: Record<MovementType, { label: string; description: string; color: string }> = {
  IN: { label: 'Entrada', description: 'Agregar unidades al stock', color: 'text-emerald-600' },
  OUT: { label: 'Salida', description: 'Retirar unidades del stock', color: 'text-destructive' },
  ADJ: { label: 'Ajuste', description: 'Fijar el stock a un valor exacto', color: 'text-blue-600' },
}

export function AdjustmentDialog({ product, onClose }: Props) {
  const { adjust } = useInventory()
  const [type, setType] = useState<MovementType>('IN')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!product) return
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) return

    setSaving(true)
    try {
      await adjust({ product_id: product.id, type, quantity: qty, notes })
      onClose()
    } catch {
      // toast shown in hook
    } finally {
      setSaving(false)
    }
  }

  const stockPreview = () => {
    if (!product || !quantity) return null
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) return null
    switch (type) {
      case 'IN': return product.stock + qty
      case 'OUT': return Math.max(0, product.stock - qty)
      case 'ADJ': return qty
    }
  }

  return (
    <Dialog open={!!product} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento de Inventario</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Producto seleccionado */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{product.name}</p>
              {product.sku && <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>}
              <p className="text-xs mt-1">
                Stock actual: <span className="font-semibold">{product.stock}</span>
                {product.min_stock > 0 && (
                  <span className="text-muted-foreground ml-2">(mínimo: {product.min_stock})</span>
                )}
              </p>
            </div>

            {/* Tipo de movimiento */}
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CONFIG) as [MovementType, typeof TYPE_CONFIG[MovementType]][]).map(([t, cfg]) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-lg border p-2 text-center transition-colors ${
                    type === t
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-accent'
                  }`}
                >
                  <p className={`text-sm font-semibold ${type === t ? 'text-primary' : cfg.color}`}>{cfg.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{cfg.description}</p>
                </button>
              ))}
            </div>

            {/* Cantidad */}
            <div className="space-y-1">
              <Label className="text-xs">
                {type === 'ADJ' ? 'Nuevo stock total *' : 'Cantidad *'}
              </Label>
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={type === 'ADJ' ? 'Stock final deseado' : 'Cantidad de unidades'}
                className="h-8 text-sm"
              />
            </div>

            {/* Preview */}
            {stockPreview() !== null && (
              <div className="rounded bg-muted px-3 py-2 text-xs">
                Stock resultante:{' '}
                <span className="font-bold text-sm">{stockPreview()}</span>
              </div>
            )}

            {/* Notas */}
            <div className="space-y-1">
              <Label className="text-xs">Motivo / Observaciones</Label>
              <Input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ej: Corrección por conteo físico..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !quantity || parseFloat(quantity) <= 0}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar movimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
