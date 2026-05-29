import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { CatalogTable } from './CatalogTable'
import { useCategories } from '../hooks/useCategories'
import type { Category } from '../types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function CategoryTab() {
  const { categories, loading, load, create, update, remove } = useCategories()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)

  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { setEditing(null); reset({ name: '', description: '' }); setOpen(true) }
  const openEdit = (row: Category) => { setEditing(row); reset({ name: row.name, description: row.description ?? '' }); setOpen(true) }

  const onSubmit = async (data: FormData) => {
    if (editing) {
      await update(editing.id, { name: data.name, description: data.description || null, parent_id: null })
    } else {
      await create({ name: data.name, description: data.description || null, parent_id: null })
    }
    setOpen(false)
  }

  return (
    <>
      <CatalogTable<Category>
        data={categories}
        columns={[
          { header: 'Nombre', cell: row => <span className="font-medium">{row.name}</span> },
          { header: 'Descripción', cell: row => <span className="text-muted-foreground">{row.description ?? '—'}</span> },
        ]}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={remove}
        searchPlaceholder="Buscar categoría..."
        searchFilter={(row, q) => row.name.toLowerCase().includes(q)}
        emptyText="No hay categorías. Agrega una para comenzar."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nombre *</Label>
              <Input id="cat-name" placeholder="Ej: Electrónica" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Descripción</Label>
              <Textarea id="cat-desc" placeholder="Descripción opcional" rows={2} {...register('description')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
