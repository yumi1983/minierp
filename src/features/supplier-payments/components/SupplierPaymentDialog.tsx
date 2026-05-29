import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, ImageIcon, X, ExternalLink } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { Separator } from '@/shared/components/ui/separator'
import { formatCurrency } from '@/shared/utils/currency'
import { formatDateTime } from '@/shared/utils/date'
import { useSupplierPayments } from '../hooks/useSupplierPayments'
import type { SupplierDebtWithDetail, PaymentMethod } from '../types'
import toast from 'react-hot-toast'

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  check: 'Cheque',
}

interface Props {
  debtId: string | null
  onClose: () => void
}

export function SupplierPaymentDialog({ debtId, onClose }: Props) {
  const { getDetail, registerPayment, uploadVoucher } = useSupplierPayments()
  const [detail, setDetail] = useState<SupplierDebtWithDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null)
  const [uploadingVoucher, setUploadingVoucher] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!debtId) { setDetail(null); return }
    setLoadingDetail(true)
    setAmount('')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setReference('')
    setNotes('')
    setMethod('cash')
    setVoucherFile(null)
    setVoucherPreview(null)
    getDetail(debtId)
      .then(d => setDetail(d))
      .finally(() => setLoadingDetail(false))
  }, [debtId])

  const balance = detail ? detail.total_amount - detail.paid_amount : 0

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    setVoucherFile(file)
    setVoucherPreview(URL.createObjectURL(file))
  }

  const handlePay = async () => {
    if (!detail || savingRef.current) return
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) return
    savingRef.current = true
    setSaving(true)
    try {
      let voucherUrl: string | null = null
      if (voucherFile) {
        setUploadingVoucher(true)
        const tempId = `${detail.id}-${Date.now()}`
        voucherUrl = await uploadVoucher(tempId, voucherFile)
        setUploadingVoucher(false)
      }
      await registerPayment({
        debt_id: detail.id,
        amount: amountNum,
        payment_method: method,
        payment_date: paymentDate,
        reference,
        notes,
        voucher_url: voucherUrl,
      })
      onClose()
    } catch (err) {
      setUploadingVoucher(false)
      const msg = err instanceof Error ? err.message : 'Error al registrar pago'
      toast.error(msg)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!debtId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="flex flex-col w-full max-w-lg max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <>
              {/* Resumen de deuda */}
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Proveedor</span>
                  <span className="font-medium text-right">{detail.supplier_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Orden de Compra</span>
                  <span className="font-mono text-xs font-medium">{detail.order_code}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Total</span>
                  <span>{formatCurrency(detail.total_amount)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Pagado</span>
                  <span className="text-emerald-600">{formatCurrency(detail.paid_amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between gap-2 font-semibold">
                  <span>Saldo pendiente</span>
                  <span className="text-destructive text-base">{formatCurrency(balance)}</span>
                </div>
              </div>

              {/* Campos del pago */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Monto a pagar *</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={balance}
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder={`Máx. ${balance.toFixed(2)}`}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Método de pago</Label>
                    <Select value={method} onValueChange={v => setMethod(v as PaymentMethod)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(PAYMENT_LABELS) as [PaymentMethod, string][]).map(([v, l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Fecha de pago *</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">N° Referencia / Comprobante</Label>
                    <Input
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder="Opcional"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observaciones</Label>
                    <Input
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Opcional"
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {/* Voucher */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Voucher / imagen del pago</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(f) }}
                  />
                  {voucherPreview ? (
                    <div className="relative inline-block">
                      <img
                        src={voucherPreview}
                        alt="Voucher"
                        className="h-24 w-auto rounded-lg border object-cover cursor-pointer"
                        onClick={() => window.open(voucherPreview, '_blank')}
                      />
                      <button
                        type="button"
                        onClick={() => { setVoucherFile(null); setVoucherPreview(null) }}
                        className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 shadow"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                      <p className="mt-1 text-xs text-muted-foreground truncate max-w-[200px]">{voucherFile?.name}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors w-full"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Adjuntar imagen del voucher
                    </button>
                  )}
                </div>
              </div>

              {/* Historial de pagos anteriores */}
              {detail.payments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagos anteriores</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {detail.payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium shrink-0">{formatCurrency(p.amount)}</span>
                          <span className="text-muted-foreground shrink-0">{PAYMENT_LABELS[p.payment_method as PaymentMethod] ?? p.payment_method}</span>
                          {p.reference && <span className="text-muted-foreground truncate">#{p.reference}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-muted-foreground">{formatDateTime(p.created_at)}</span>
                          {p.voucher_url && (
                            <a href={p.voucher_url} target="_blank" rel="noopener noreferrer" title="Ver voucher" className="text-blue-500 hover:text-blue-700">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 sm:justify-end gap-2">
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handlePay}
            disabled={saving || !detail || !amount || parseFloat(amount) <= 0 || detail?.status === 'paid'}
          >
            {(saving || uploadingVoucher) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {uploadingVoucher ? 'Subiendo voucher...' : 'Registrar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
