import { nanoid } from 'nanoid'

export function generateId(): string {
  return nanoid()
}

export function generateUUID(): string {
  return crypto.randomUUID()
}
