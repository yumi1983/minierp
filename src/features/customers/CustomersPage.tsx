import { useEffect, useState } from 'react'
import { Users, Plus, Search, Pencil, Trash2, CreditCard } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { formatCurrency } from '@/shared/utils/currency'
import { useCustomers } from './hooks/useCustomers'
import { CustomerForm } from './components/CustomerForm'
import type { Customer } from './types'
import type { CustomerFormData } from './customer.schema'

export function CustomersPage() {
  const { customers, loading, load, create, update, remove } = useCustomers()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tax_id?.includes(search)) ||
    (c.phone?.includes(search))
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (c: Customer) => { setEditing(c); setFormOpen(true) }

  const handleSubmit = async (data: CustomerFormData) => {
    const dto = {
      name: data.name,
      tax_id: data.tax_id || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      credit_limit: data.credit_limit,
      notes: data.notes || null,
      is_active: data.is_active,
    }
    if (editing) { await update(editing.id, dto) } else { await create(dto) }
    setFormOpen(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Clientes</h2>
            <p className="text-sm text-muted-foreground">
              {customers.length} cliente{customers.length !== 1 ? 's' : ''} registrado{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, DNI o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Cliente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">DNI / RUC</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Teléfono</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Correo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Límite crédito</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Estado</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {search ? 'Sin resultados' : 'No hay clientes. Agrega el primero.'}
                </td>
              </tr>
            ) : (
              filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        {c.address && (
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">{c.address}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {c.tax_id ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                    {c.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                    {c.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {c.credit_limit > 0 ? (
                      <div className="flex items-center justify-end gap-1">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="tabular-nums">{formatCurrency(c.credit_limit)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <Badge variant={c.is_active ? 'success' : 'secondary'}>
                      {c.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                      >
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
                <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground">
                  {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
                  {search && ` de ${customers.length}`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Dialog formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editing}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!deleteId}
        title="¿Eliminar cliente?"
        description="Se eliminará el cliente del sistema. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={async () => { await remove(deleteId!); setDeleteId(null) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

