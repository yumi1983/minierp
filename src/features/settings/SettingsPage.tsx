import { useEffect, useState } from 'react'
import { Settings, Sun, Moon, Monitor, Building2, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { useCompanyStore } from '@/features/company/store/company.store'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) ?? 'system'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
  localStorage.setItem('theme', theme)
}

export function SettingsPage() {
  const company = useCompanyStore(s => s.settings)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const handleTheme = (t: Theme) => {
    setTheme(t)
    applyTheme(t)
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Configuración</h2>
          <p className="text-sm text-muted-foreground">Preferencias del sistema</p>
        </div>
      </div>

      {/* Empresa */}
      <section className="rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Datos de la empresa</h3>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
            <Link to="/company">
              <ExternalLink className="h-3.5 w-3.5" />
              Editar empresa
            </Link>
          </Button>
        </div>

        {company ? (
          <div className="flex items-center gap-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="h-14 w-14 rounded-lg object-cover border bg-white" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {company.trade_name?.charAt(0).toUpperCase() ?? 'E'}
                </span>
              </div>
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">{company.trade_name ?? '—'}</p>
              {company.legal_name && <p className="text-sm text-muted-foreground">{company.legal_name}</p>}
              {company.tax_id && (
                <p className="text-xs text-muted-foreground">RUC: {company.tax_id}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px]">
                  {company.currency_symbol} {company.currency}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {company.tax_label} {company.tax_rate}%
                </Badge>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground flex items-center gap-3">
            <Building2 className="h-5 w-5 shrink-0" />
            <div>
              <p>No hay empresa configurada.</p>
              <Link to="/company" className="text-primary underline-offset-2 hover:underline text-xs">
                Configurar empresa →
              </Link>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Apariencia */}
      <section className="space-y-4">
        <h3 className="font-semibold text-sm">Apariencia</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Oscuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Monitor },
          ] as { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(opt => {
            const Icon = opt.icon
            const active = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => handleTheme(opt.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-accent text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{opt.label}</span>
                {active && (
                  <span className="text-[10px] text-primary font-semibold">Activo</span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <Separator />

      {/* Series de documentos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Series de documentos</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" asChild>
            <Link to="/company">
              <ExternalLink className="h-3.5 w-3.5" />
              Cambiar series
            </Link>
          </Button>
        </div>
        {company ? (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Notas de Pedido', value: company.receipt_series },
              { label: 'Facturas', value: company.invoice_series },
              { label: 'Órdenes de Compra', value: company.po_series },
            ].map(s => (
              <div key={s.label} className="rounded-lg border p-3 bg-muted/30">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="font-mono font-bold text-base mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Configura la empresa para ver las series.</p>
        )}
      </section>

      <Separator />

      {/* Información del sistema */}
      <section className="space-y-3">
        <h3 className="font-semibold text-sm">Sistema</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Versión</p>
            <p className="font-mono font-medium mt-0.5">1.0.0</p>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Almacenamiento local</p>
            <p className="font-medium mt-0.5">IndexedDB (offline-first)</p>
          </div>
        </div>
      </section>
    </div>
  )
}
