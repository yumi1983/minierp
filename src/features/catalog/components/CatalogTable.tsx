import { useState } from 'react'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'

interface Column<T> {
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

interface Props<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  onAdd: () => void
  onEdit: (row: T) => void
  onDelete: (id: string) => Promise<void>
  searchPlaceholder?: string
  searchFilter?: (row: T, query: string) => boolean
  emptyText?: string
}

export function CatalogTable<T extends { id: string }>({
  data, columns, onAdd, onEdit, onDelete,
  searchPlaceholder = 'Buscar...',
  searchFilter,
  emptyText = 'No hay registros',
}: Props<T>) {
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = searchFilter && search
    ? data.filter(row => searchFilter(row, search.toLowerCase()))
    : data

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className={`px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {search ? 'Sin resultados' : emptyText}
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  {columns.map((col, i) => (
                    <td key={i} className={`px-4 py-3 ${col.className ?? ''}`}>
                      {col.cell(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(row)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            {search && data.length !== filtered.length && ` de ${data.length}`}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="¿Eliminar registro?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => { await onDelete(deleteId!); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
