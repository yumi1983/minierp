import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { CatalogTable } from './CatalogTable'
import { useBrands } from '../hooks/useBrands'
import type { Brand } from '../types'

const schema = z.object({ name: z.string().min(1, 'El nombre es requerido') })
type FormData = z.infer<typeof schema>

export function BrandTab() {
  const { brands, load, create, update, remove } = useBrands()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Brand | null>(null)

  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { setEditing(null); reset({ name: '' }); setOpen(true) }
  const openEdit = (row: Brand) => { setEditing(row); reset({ name: row.name }); setOpen(true) }

  const onSubmit = async (data: FormData) => {
    if (editing) await update(editing.id, { name: data.name })
    else await create({ name: data.name })
    setOpen(false)
  }

  return (
    <>
      <CatalogTable<Brand>
        data={brands}
        columns={[
          { header: 'Nombre', cell: row => <span className="font-medium">{row.name}</span> },
        ]}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={remove}
        searchPlaceholder="Buscar marca..."
        searchFilter={(row, q) => row.name.toLowerCase().includes(q)}
        emptyText="No hay marcas registradas."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar marca' : 'Nueva marca'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="brand-name">Nombre *</Label>
              <Input id="brand-name" placeholder="Ej: Samsung" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
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
