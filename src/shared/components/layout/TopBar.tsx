import { Moon, Sun, LogOut, User, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/core/auth/useAuth'
import { useNetworkStatus } from '@/core/network/useNetworkStatus'
import { useSyncStatus } from '@/core/sync/useSyncStatus'
import { syncEngine } from '@/core/sync/SyncEngine'
import { cn } from '@/shared/utils/cn'

interface Props {
  title?: string
}

export function TopBar({ title }: Props) {
  const { user, signOut, orgId } = useAuth()
  const isOnline = useNetworkStatus()
  const syncStatus = useSyncStatus()

  const handleSync = () => {
    syncEngine.forceUnlock()
    if (orgId && isOnline) syncEngine.flush(orgId)
  }

  const handleRetryErrors = () => {
    if (orgId && isOnline) syncEngine.retryErrors(orgId)
  }

  const handleThemeToggle = () => {
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        {title && <h1 className="text-sm font-semibold">{title}</h1>}
      </div>

      <div className="flex items-center gap-2">
        {/* Estado de conexión */}
        {!isOnline && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <WifiOff className="h-3 w-3" />
            Sin conexión
          </div>
        )}

        {/* Errores de sync atascados */}
        {isOnline && syncStatus.errorCount > 0 && (
          <button
            onClick={handleRetryErrors}
            title="Hay operaciones que no pudieron sincronizarse. Clic para reintentar."
            className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
          >
            <AlertTriangle className="h-3 w-3" />
            {syncStatus.errorCount} error{syncStatus.errorCount !== 1 ? 'es' : ''} — Reintentar
          </button>
        )}

        {/* Sync status — pendientes normales */}
        {isOnline && syncStatus.pendingCount > 0 && syncStatus.errorCount === 0 && (
          <button
            onClick={handleSync}
            className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
          >
            <RefreshCw className={cn('h-3 w-3', syncStatus.phase === 'pushing' && 'animate-spin')} />
            {syncStatus.pendingCount} pendientes
          </button>
        )}

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={handleThemeToggle}>
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User menu */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          {user?.email && (
            <span className="hidden text-xs text-muted-foreground sm:block">
              {user.email.split('@')[0]}
            </span>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={signOut} title="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
