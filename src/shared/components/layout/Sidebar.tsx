import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Users,
  UserCheck,
  CreditCard,
  Banknote,
  DollarSign,
  Settings,
  Building2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Truck,
  Tag,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { useAuth } from '@/core/auth/useAuth'
import { useCompanyStore } from '@/features/company/store/company.store'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Productos', href: '/products', icon: Package },
  { label: 'Catálogo', href: '/catalog', icon: Tag },
  { label: 'Inventario', href: '/inventory', icon: Warehouse },
  { label: 'Compras', href: '/purchases', icon: ShoppingCart },
  { label: 'Proveedores', href: '/suppliers', icon: Truck },
  { label: 'Pagos a Proveedores', href: '/supplier-payments', icon: DollarSign },
  { label: 'Clientes', href: '/customers', icon: Users },
  { label: 'Ventas', href: '/sales', icon: DollarSign },
  { label: 'Cuentas por Cobrar', href: '/receivables', icon: CreditCard },
  { label: 'Caja', href: '/cash-register', icon: Banknote },
  { label: 'Usuarios', href: '/users', icon: UserCheck, roles: ['admin'] },
  { label: 'Reportes', href: '/reports', icon: BarChart3 },
  { label: 'Empresa', href: '/company', icon: Building2 },
  { label: 'Configuración', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { role } = useAuth()
  const company = useCompanyStore(s => s.settings)

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true
    return role && item.roles.includes(role)
  })

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Empresa */}
      <div className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-0')}>
        {collapsed ? (
          <CompanyAvatar company={company} size="sm" />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <CompanyAvatar company={company} size="sm" />
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate leading-tight">
                {company?.trade_name ?? 'Mini ERP'}
              </p>
              {company?.trade_name && (
                <p className="text-[10px] text-muted-foreground truncate leading-tight">Sistema ERP</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-0.5 px-2">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href)

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.href}
                      className={cn(
                        'flex h-9 w-full items-center justify-center rounded-md transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              )
            }

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  )
}

function CompanyAvatar({
  company,
  size,
}: {
  company: { trade_name: string | null; logo_url: string | null } | null
  size: 'sm'
}) {
  const dim = 'h-8 w-8'
  const initial = company?.trade_name?.charAt(0).toUpperCase() ?? 'E'

  if (company?.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={company.trade_name ?? 'Logo'}
        className={`${dim} rounded-lg object-cover shrink-0 border bg-white`}
      />
    )
  }

  return (
    <div className={`${dim} flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0`}>
      {initial}
    </div>
  )
}
