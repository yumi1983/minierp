import type { ReactNode } from 'react'
import { useAuth } from './useAuth'
import type { UserRole } from '@/shared/types/common.types'

interface Props {
  allowed: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGuard({ allowed, children, fallback = null }: Props) {
  const { role } = useAuth()
  if (!role || !allowed.includes(role)) return <>{fallback}</>
  return <>{children}</>
}
