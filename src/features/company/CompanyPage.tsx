import { Building2 } from 'lucide-react'
import { CompanyForm } from './components/CompanyForm'

export function CompanyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Configuración de empresa</h2>
          <p className="text-sm text-muted-foreground">
            Datos que aparecerán en PDFs, reportes y comprobantes
          </p>
        </div>
      </div>

      <CompanyForm />
    </div>
  )
}

