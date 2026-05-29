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
import { Badge } from '@/shared/components/ui/badge'
import { CatalogTable } from './CatalogTable'
import { useUnits } from '../hooks/useUnits'
import type { Unit } from '../types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  abbreviation: z.string().min(1, 'La abreviatura es requerida').max(10),
})
type FormData = z.infer<typeof schema>

const DEFAULT_UNITS = [
  { name: 'Unidad', abbreviation: 'UND' },
  { name: 'Kilogramo', abbreviation: 'KG' },
  { name: 'Gramo', abbreviation: 'GR' },
  { name: 'Litro', abbreviation: 'LT' },
  { name: 'Metro', abbreviation: 'MT' },
  { name: 'Caja', abbreviation: 'CJA' },
  { name: 'Docena', abbreviation: 'DOC' },
  { name: 'Par', abbreviation: 'PAR' },
]

export function UnitTab() {
  const { units, load, create, update, remove } = useUnits()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Unit | null>(null)

  useEffect(() => { load() }, [])

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { setEditing(null); reset({ name: '', abbreviation: '' }); setOpen(true) }
  const openEdit = (row: Unit) => { setEditing(row); reset({ name: row.name, abbreviation: row.abbreviation }); setOpen(true) }

  const onSubmit = async (data: FormData) => {
    if (editing) await update(editing.id, data)
    else await create(data)
    setOpen(false)
  }

  return (
    <>
      <CatalogTable<Unit>
        data={units}
        columns={[
          { header: 'Nombre', cell: row => <span className="font-medium">{row.name}</span> },
          { header: 'Abreviatura', cell: row => <Badge variant="secondary">{row.abbreviation}</Badge>, className: 'w-32' },
        ]}
        onAdd={openCreate}
        onEdit={openEdit}
        onDelete={remove}
        searchPlaceholder="Buscar unidad..."
        searchFilter={(row, q) => row.name.toLowerCase().includes(q) || row.abbreviation.toLowerCase().includes(q)}
        emptyText="No hay unidades de medida registradas."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar unidad' : 'Nueva unidad de medida'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!editing && (
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_UNITS.map(u => (
                  <button
                    key={u.abbreviation}
                    type="button"
                    onClick={() => { setValue('name', u.name); setValue('abbreviation', u.abbreviation) }}
                    className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent transition-colors"
                  >
                    {u.abbreviation}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="unit-name">Nombre *</Label>
                <Input id="unit-name" placeholder="Ej: Kilogramo" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit-abbr">Abreviatura *</Label>
                <Input id="unit-abbr" placeholder="KG" maxLength={10} {...register('abbreviation')} />
                {errors.abbreviation && <p className="text-xs text-destructive">{errors.abbreviation.message}</p>}
              </div>
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
