import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/core/db/dexie'
import { syncEngine, type SyncEngineStatus } from './SyncEngine'

export interface SyncStatusExtended extends SyncEngineStatus {
  errorCount: number
}

export function useSyncStatus(): SyncStatusExtended {
  const [status, setStatus] = useState<SyncStatusExtended>({
    phase: 'idle',
    pendingCount: 0,
    errorCount: 0,
  })

  useEffect(() => {
    const pendingSub = liveQuery(() =>
      db.syncQueue.where('status').anyOf(['pending', 'error']).count()
    ).subscribe(count => {
      setStatus(s => ({ ...s, pendingCount: count }))
    })

    // Operaciones en error con 5+ intentos = atascadas, no se reintentarán solas
    const errorSub = liveQuery(() =>
      db.syncQueue
        .where('status').equals('error')
        .and(op => (op.attempts ?? 0) >= 5)
        .count()
    ).subscribe(count => {
      setStatus(s => ({ ...s, errorCount: count }))
    })

    const unsubEngine = syncEngine.subscribe(engineStatus => {
      setStatus(s => ({ ...s, phase: engineStatus.phase }))
    })

    return () => {
      pendingSub.unsubscribe()
      errorSub.unsubscribe()
      unsubEngine()
    }
  }, [])

  return status
}
