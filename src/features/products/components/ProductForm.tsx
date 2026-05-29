import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X, ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { productSchema, type ProductFormData } from '../product.schema'
import type { Product } from '../types'
import type { Category, Brand, Unit } from '@/features/catalog/types'

interface Props {
  product?: Product | null
  categories: Category[]
  brands: Brand[]
  units: Unit[]
  onSubmit: (data: ProductFormData) => Promise<void>
  onUploadImage: (file: File) => Promise<string>
  onCancel: () => void
}

export function ProductForm({ product, categories, brands, units, onSubmit, onUploadImage, onCancel }: Props) {
  const imgRef = useRef<HTMLInputElement>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(product?.image_url ?? null)
  const [uploadingImg, setUploadingImg] = useState(false)

  const { register, handleSubmit, control, reset, setValue, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', sku: '', barcode: '', description: '',
      category_id: '', brand_id: '', unit_id: '',
      purchase_price: 0, sale_price: 0,
      stock: 0, min_stock: 0,
      is_active: true, image_url: null,
    },
  })

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        description: product.description ?? '',
        category_id: product.category_id ?? '',
        brand_id: product.brand_id ?? '',
        unit_id: product.unit_id ?? '',
        purchase_price: product.purchase_price,
        sale_price: product.sale_price,
        stock: product.stock,
        min_stock: product.min_stock,
        is_active: product.is_active,
        image_url: product.image_url,
      })
      setImgPreview(product.image_url)
    }
  }, [product, reset])

  const handleImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    setImgPreview(URL.createObjectURL(file))
    setUploadingImg(true)
    try {
      const url = await onUploadImage(file)
      setValue('image_url', url)
      setImgPreview(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al subir imagen'
      toast.error(msg)
      setImgPreview(product?.image_url ?? null)
    } finally {
      setUploadingImg(false)
    }
  }

  const handleSubmitForm = async (data: ProductFormData) => {
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitForm)} className="space-y-6">
      {/* Imagen */}
      <div className="flex gap-4 items-start">
        <div
          onClick={() => imgRef.current?.click()}
          className="relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-primary/50 hover:bg-accent/50 transition-colors overflow-hidden"
        >
          {imgPreview ? (
            <>
              <img src={imgPreview} alt="Producto" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setImgPreview(null); setValue('image_url', null) }}
                className="absolute top-1 right-1 rounded-full bg-destructive p-0.5"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </>
          ) : uploadingImg ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Imagen</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="name">Nombre del producto *</Label>
          <Input id="name" placeholder="Ej: Arroz extra 5kg" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          <p className="text-xs text-muted-foreground">Clic en el cuadro para subir imagen</p>
        </div>
        <input ref={imgRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f) }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" placeholder="Ej: ARROZ-001" {...register('sku')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Código de barras</Label>
          <Input id="barcode" placeholder="Ej: 7501055300884" {...register('barcode')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" placeholder="Descripción del producto..." rows={2} {...register('description')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Categoría</Label>
          <Controller name="category_id" control={control} render={({ field }) => (
            <Select
              value={field.value || 'none'}
              onValueChange={v => field.onChange(v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1.5">
          <Label>Marca</Label>
          <Controller name="brand_id" control={control} render={({ field }) => (
            <Select
              value={field.value || 'none'}
              onValueChange={v => field.onChange(v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sin marca" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin marca</SelectItem>
                {brands.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
        <div className="space-y-1.5">
          <Label>Unidad</Label>
          <Controller name="unit_id" control={control} render={({ field }) => (
            <Select
              value={field.value || 'none'}
              onValueChange={v => field.onChange(v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="Sin unidad" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin unidad</SelectItem>
                {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="purchase_price">Precio de compra *</Label>
          <Input id="purchase_price" type="number" step="0.01" min="0" {...register('purchase_price')} />
          {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sale_price">Precio de venta *</Label>
          <Input id="sale_price" type="number" step="0.01" min="0" {...register('sale_price')} />
          {errors.sale_price && <p className="text-xs text-destructive">{errors.sale_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock inicial</Label>
          <Input id="stock" type="number" step="0.001" min="0" {...register('stock')} />
          {errors.stock && <p className="text-xs text-destructive">{errors.stock.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="min_stock">Stock mínimo</Label>
          <Input id="min_stock" type="number" step="0.001" min="0" {...register('min_stock')} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Controller name="is_active" control={control} render={({ field }) => (
          <Switch checked={field.value} onCheckedChange={field.onChange} />
        )} />
        <Label className="cursor-pointer">Producto activo</Label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {product ? 'Guardar cambios' : 'Crear producto'}
        </Button>
      </div>
    </form>
  )
}
