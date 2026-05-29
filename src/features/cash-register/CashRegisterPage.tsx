import { useEffect, useState } from 'react'
import { Banknote, Plus, Minus, Lock, Unlock, History, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'
import { useCashRegister } from './hooks/useCashRegister'
import type { LocalCashSession, LocalCashMovement } from './hooks/useCashRegister'

export function CashRegisterPage() {
  const { openSession, sessions, movements, loading, load, openCash, closeCash, addMovement, getSessionMovements } = useCashRegister()

  const [openAmount, setOpenAmount] = useState('')
  const [closeAmount, setCloseAmount] = useState('')
  const [movType, setMovType] = useState<'income' | 'expense'>('income')
  const [movAmount, setMovAmount] = useState('')
  const [movDesc, setMovDesc] = useState('')
  const [savingOpen, setSavingOpen] = useState(false)
  const [savingClose, setSavingClose] = useState(false)
  const [savingMov, setSavingMov] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionMovements, setSessionMovements] = useState<Record<string, LocalCashMovement[]>>({})

  useEffect(() => { load() }, [])

  const income = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0)
  const expense = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0)
  const currentBalance = openSession ? openSession.opening_amount + income - expense : 0
  const expectedOnClose = openSession ? currentBalance : 0

  const handleOpen = async () => {
    const amount = parseFloat(openAmount)
    if (isNaN(amount) || amount < 0) { toast.error('Ingresa un monto válido'); return }
    setSavingOpen(true)
    try { await openCash(amount); setOpenAmount('') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSavingOpen(false) }
  }

  const handleClose = async () => {
    const amount = parseFloat(closeAmount)
    if (isNaN(amount) || amount < 0) { toast.error('Ingresa el monto real en caja'); return }
    setSavingClose(true)
    try { await closeCash(amount); setShowCloseDialog(false); setCloseAmount('') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSavingClose(false) }
  }

  const handleMovement = async () => {
    const amount = parseFloat(movAmount)
    if (isNaN(amount) || amount <= 0) { toast.error('Ingresa un monto válido'); return }
    if (!movDesc.trim()) { toast.error('Ingresa una descripción'); return }
    setSavingMov(true)
    try { await addMovement({ type: movType, amount, description: movDesc }); setMovAmount(''); setMovDesc('') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSavingMov(false) }
  }

  const toggleSession = async (sessionId: string) => {
    if (expandedSession === sessionId) { setExpandedSession(null); return }
    setExpandedSession(sessionId)
    if (!sessionMovements[sessionId]) {
      const movs = await getSessionMovements(sessionId)
      setSessionMovements(prev => ({ ...prev, [sessionId]: movs }))
    }
  }

  const closedSessions = sessions.filter(s => s.status === 'closed')

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2"><Banknote className="h-5 w-5 text-primary" /></div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Caja</h2>
          <p className="text-sm text-muted-foreground">Apertura, cierre y arqueo de caja</p>
        </div>
      </div>

      {!openSession ? (
        /* ── CAJA CERRADA ── */
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Caja cerrada</h3>
            </div>
            <p className="text-sm text-muted-foreground">Abre la caja para empezar a registrar movimientos.</p>
            <div className="space-y-2">
              <Label className="text-xs">Monto de apertura</Label>
              <Input type="number" min="0" step="0.01" value={openAmount}
                onChange={e => setOpenAmount(e.target.value)}
                placeholder="0.00" className="text-lg font-semibold h-10" />
            </div>
            <Button className="w-full" onClick={handleOpen} disabled={savingOpen}>
              <Unlock className="h-4 w-4" />Abrir Caja
            </Button>
          </div>

          {closedSessions.length > 0 && (
            <div className="rounded-xl border p-4 space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />Últimas sesiones
              </h3>
              {closedSessions.slice(0, 5).map(s => (
                <SessionCard key={s.id} session={s}
                  expanded={expandedSession === s.id}
                  movements={sessionMovements[s.id]}
                  onToggle={() => toggleSession(s.id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── CAJA ABIERTA ── */
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Columna izquierda: resumen */}
          <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-3 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center gap-2">
                <Unlock className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Caja abierta</span>
                <Badge variant="success" className="ml-auto text-[10px]">Activa</Badge>
              </div>
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Apertura</span>
                  <span className="tabular-nums">{formatCurrency(openSession.opening_amount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>+ Ingresos</span>
                  <span className="tabular-nums">{formatCurrency(income)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>- Egresos</span>
                  <span className="tabular-nums">{formatCurrency(expense)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Saldo actual</span>
                  <span className="tabular-nums text-primary">{formatCurrency(currentBalance)}</span>
                </div>
              </div>
              <Button variant="destructive" className="w-full mt-2" size="sm"
                onClick={() => { setCloseAmount(currentBalance.toFixed(2)); setShowCloseDialog(true) }}>
                <Lock className="h-4 w-4" />Cerrar Caja
              </Button>
            </div>

            {/* Agregar movimiento */}
            <div className="rounded-xl border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Registrar movimiento</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setMovType('income')}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${movType === 'income' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' : 'hover:bg-accent text-muted-foreground'}`}>
                  <TrendingUp className="h-3.5 w-3.5" />Ingreso
                </button>
                <button onClick={() => setMovType('expense')}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${movType === 'expense' ? 'border-destructive bg-red-50 text-destructive dark:bg-red-900/30' : 'hover:bg-accent text-muted-foreground'}`}>
                  <TrendingDown className="h-3.5 w-3.5" />Egreso
                </button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Monto</Label>
                <Input type="number" min="0.01" step="0.01" value={movAmount}
                  onChange={e => setMovAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción *</Label>
                <Input value={movDesc} onChange={e => setMovDesc(e.target.value)}
                  placeholder="Ej: Pago servicio, cobro cliente..." className="h-8 text-sm" />
              </div>
              <Button className="w-full" size="sm" onClick={handleMovement} disabled={savingMov}>
                {movType === 'income' ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>

          {/* Columna derecha: movimientos de la sesión */}
          <div className="lg:col-span-2 rounded-xl border overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Movimientos de la sesión ({movements.length})
            </div>
            {movements.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No hay movimientos en esta sesión.
              </div>
            ) : (
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {movements.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-1.5 ${m.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        {m.type === 'income'
                          ? <TrendingUp className="h-3 w-3 text-emerald-600" />
                          : <TrendingDown className="h-3 w-3 text-destructive" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                      </div>
                    </div>
                    <span className={`tabular-nums font-semibold ${m.type === 'income' ? 'text-emerald-600' : 'text-destructive'}`}>
                      {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historial de sesiones cerradas (si hay caja abierta) */}
      {openSession && closedSessions.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />Historial de sesiones
          </h3>
          {closedSessions.slice(0, 5).map(s => (
            <SessionCard key={s.id} session={s}
              expanded={expandedSession === s.id}
              movements={sessionMovements[s.id]}
              onToggle={() => toggleSession(s.id)} />
          ))}
        </div>
      )}

      {/* Diálogo cierre de caja */}
      <Dialog open={showCloseDialog} onOpenChange={open => !open && setShowCloseDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Cerrar Caja</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo esperado</span>
                <span className="font-semibold">{formatCurrency(expectedOnClose)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto real en caja (arqueo) *</Label>
              <Input type="number" min="0" step="0.01" value={closeAmount}
                onChange={e => setCloseAmount(e.target.value)} className="h-8 text-sm" />
            </div>
            {closeAmount && !isNaN(parseFloat(closeAmount)) && (
              <div className={`rounded px-3 py-2 text-sm font-medium ${
                Math.abs(parseFloat(closeAmount) - expectedOnClose) < 0.01
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20'
              }`}>
                Diferencia: {formatCurrency(parseFloat(closeAmount) - expectedOnClose)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClose} disabled={savingClose}>
              <Lock className="h-4 w-4" />Confirmar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SessionCard({ session, expanded, movements, onToggle }: {
  session: LocalCashSession
  expanded: boolean
  movements?: LocalCashMovement[]
  onToggle: () => void
}) {
  const diff = session.difference ?? 0
  return (
    <div className="rounded-lg border overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent text-left transition-colors"
        onClick={onToggle}>
        <div className="space-y-0.5">
          <p className="text-xs font-medium">{formatDateTime(session.opened_at)}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Apertura: {formatCurrency(session.opening_amount)}</span>
            {session.closing_amount !== null && <span>Cierre: {formatCurrency(session.closing_amount)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {session.difference !== null && (
            <span className={`text-xs font-medium tabular-nums ${Math.abs(diff) < 0.01 ? 'text-emerald-600' : diff > 0 ? 'text-blue-600' : 'text-destructive'}`}>
              {diff > 0 ? '+' : ''}{formatCurrency(diff)}
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t bg-muted/30 divide-y">
          {!movements || movements.length === 0 ? (
            <p className="px-4 py-2 text-xs text-muted-foreground">Sin movimientos en esta sesión.</p>
          ) : (
            movements.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-muted-foreground">{m.description}</span>
                <span className={`tabular-nums font-medium ${m.type === 'income' ? 'text-emerald-600' : 'text-destructive'}`}>
                  {m.type === 'income' ? '+' : '-'}{formatCurrency(m.amount)}
                </span>
              </div>
            ))
          )}
          <div className="flex justify-between px-4 py-2 text-xs font-medium bg-muted/50">
            <span>Esperado</span><span className="tabular-nums">{formatCurrency(session.expected_amount ?? 0)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
