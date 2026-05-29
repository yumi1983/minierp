import { useEffect, useState } from 'react'
import { syncEngine } from '@/core/sync/SyncEngine'
import { useAuthStore } from '@/core/auth/authStore'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const orgId = useAuthStore((s) => s.orgId)

  // Sincronización inicial al montar cuando hay conexión y sesión
  useEffect(() => {
    if (orgId && navigator.onLine) {
      syncEngine.flush(orgId)
    }
  }, [orgId])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (orgId) syncEngine.flush(orgId)
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [orgId])

  return isOnline
}
