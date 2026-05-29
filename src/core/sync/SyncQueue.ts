import { nanoid } from 'nanoid'
import { db } from '@/core/db/dexie'
import type { SyncOperation } from './types'

export class SyncQueue {
  async enqueue(
    tableName: string,
    operation: SyncOperation['operation'],
    payload: Record<string, unknown>
  ): Promise<void> {
    const op: SyncOperation = {
      id: nanoid(),
      table_name: tableName,
      record_id: payload.id as string,
      operation,
      payload,
      attempts: 0,
      status: 'pending',
      created_at: new Date(),
    }
    await db.syncQueue.add(op)
  }

  async getPending(): Promise<SyncOperation[]> {
    return db.syncQueue
      .where('status')
      .anyOf(['pending', 'error'])
      .and((op) => op.attempts < 5)
      .sortBy('created_at')
  }

  async markProcessing(id: string): Promise<void> {
    await db.syncQueue.where('id').equals(id).modify({ status: 'processing' })
  }

  async markDone(id: string): Promise<void> {
    await db.syncQueue.where('id').equals(id).modify({ status: 'done' })
  }

  async markError(id: string, error: string): Promise<void> {
    await db.syncQueue.where('id').equals(id).modify((op) => {
      op.status = 'error'
      op.error = error
      op.attempts += 1
    })
  }

  async clearDone(): Promise<void> {
    await db.syncQueue.where('status').equals('done').delete()
  }

  async resetErrors(): Promise<number> {
    return db.syncQueue
      .where('status').equals('error')
      .modify({ status: 'pending', attempts: 0, error: undefined })
  }

  async count(): Promise<number> {
    return db.syncQueue.where('status').anyOf(['pending', 'error']).count()
  }
}

export const syncQueue = new SyncQueue()
