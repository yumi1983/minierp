import type { SyncOperation } from './types'

const NUMERIC_DELTA_FIELDS: Record<string, string[]> = {
  products: ['stock'],
}

export class ConflictResolver {
  resolve(
    op: SyncOperation,
    serverRecord: Record<string, unknown>
  ): Record<string, unknown> {
    const local = op.payload
    const deltaFields = NUMERIC_DELTA_FIELDS[op.table_name] ?? []

    if (deltaFields.length === 0) {
      // Last-Write-Wins: servidor gana
      return serverRecord
    }

    const merged = { ...serverRecord }

    for (const field of deltaFields) {
      const localVal = local[field] as number | undefined
      const serverVal = serverRecord[field] as number | undefined

      if (localVal !== undefined && serverVal !== undefined) {
        // Calcular delta desde el valor anterior guardado
        const previousVal = (local[`_prev_${field}`] as number | undefined) ?? localVal
        const delta = localVal - previousVal
        merged[field] = serverVal + delta
      }
    }

    return merged
  }
}

export const conflictResolver = new ConflictResolver()
