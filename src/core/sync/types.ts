export type SyncOperation = {
  id: string
  table_name: string
  record_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  payload: Record<string, unknown>
  attempts: number
  status: 'pending' | 'processing' | 'done' | 'error'
  created_at: Date
  error?: string
}

export type SyncMeta = {
  table_name: string
  last_synced_at: string | null
}

export type ConflictResolution = 'local' | 'remote' | 'merge'
