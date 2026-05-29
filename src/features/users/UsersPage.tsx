import { useEffect } from 'react'
import { UserCheck, Shield, ShieldCheck, ShieldAlert, Package, Calculator } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { formatDate } from '@/shared/utils/date'
import { useAuth } from '@/core/auth/useAuth'
import { useUsers, type UserRole } from './hooks/useUsers'
import type { LocalUserProfile } from '@/core/db/dexie'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  seller: 'Vendedor',
  warehouse: 'Almacén',
  accounting: 'Contabilidad',
}

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  seller: Shield,
  warehouse: Package,
  accounting: Calculator,
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'text-purple-600',
  seller: 'text-blue-600',
  warehouse: 'text-amber-600',
  accounting: 'text-emerald-600',
}

export function UsersPage() {
  const { users, loading, load, updateRole, toggleActive } = useUsers()
  const { user: currentUser, role: currentRole } = useAuth()

  useEffect(() => { load() }, [])

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2"><UserCheck className="h-5 w-5 text-primary" /></div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Usuarios</h2>
            <p className="text-sm text-muted-foreground">Gestión de usuarios y roles</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Usuario</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Rol</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Desde</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              {currentRole === 'admin' && (
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide w-40">Cambiar rol</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Cargando...
                </div>
              </td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                No hay usuarios en la organización.
              </td></tr>
            ) : (
              users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  isCurrentUser={u.id === currentUser?.id}
                  canEdit={currentRole === 'admin' && u.id !== currentUser?.id}
                  onRoleChange={role => updateRole(u.id, role)}
                  onToggleActive={active => toggleActive(u.id, active)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">¿Cómo agregar usuarios?</p>
        <p>Los usuarios se crean desde el panel de autenticación de Supabase. Una vez que el usuario se registra con el correo de tu organización, aparecerá automáticamente en esta lista.</p>
      </div>
    </div>
  )
}

function UserRow({ user, isCurrentUser, canEdit, onRoleChange, onToggleActive }: {
  user: LocalUserProfile
  isCurrentUser: boolean
  canEdit: boolean
  onRoleChange: (role: UserRole) => void
  onToggleActive: (active: boolean) => void
}) {
  const RoleIcon = ROLE_ICONS[user.role] ?? Shield
  const roleColor = ROLE_COLORS[user.role] ?? 'text-muted-foreground'

  return (
    <tr className={`hover:bg-muted/30 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
            {(user.full_name ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user.full_name ?? 'Sin nombre'}</p>
            {isCurrentUser && <span className="text-[10px] text-muted-foreground">(tú)</span>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <RoleIcon className={`h-3.5 w-3.5 ${roleColor}`} />
          <span className="text-xs">{ROLE_LABELS[user.role]}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground hidden sm:table-cell">
        {formatDate(user.created_at)}
      </td>
      <td className="px-4 py-3 text-center">
        {canEdit ? (
          <Switch
            checked={user.is_active}
            onCheckedChange={checked => onToggleActive(checked)}
          />
        ) : (
          <Badge variant={user.is_active ? 'success' : 'secondary'}>
            {user.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        )}
      </td>
      {canEdit !== undefined && (
        <td className="px-4 py-3 text-center">
          {canEdit ? (
            <Select value={user.role} onValueChange={v => onRoleChange(v as UserRole)}>
              <SelectTrigger className="h-7 text-xs w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}
    </tr>
  )
}
