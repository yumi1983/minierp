import * as XLSX from 'xlsx'
import { formatDate, formatDateTime } from '@/shared/utils/date'
import { formatCurrency } from '@/shared/utils/currency'
import type { LocalSale, LocalPurchaseOrder, LocalCreditAccount, LocalSupplierDebt } from '@/core/db/dexie'
import type { Product } from '@/features/products/types'

interface ReportData {
  tab: string
  sales: LocalSale[]
  purchases: LocalPurchaseOrder[]
  receivables: LocalCreditAccount[]
  payables: LocalSupplierDebt[]
  inventory: Product[]
  customerMap: Record<string, string>
  supplierMap: Record<string, string>
  productMap: Record<string, string>
  range: { from: string; to: string }
}

const SHEET_NAMES: Record<string, string> = {
  sales: 'Ventas',
  purchases: 'Compras',
  inventory: 'Inventario',
  receivables: 'Por Cobrar',
  payables: 'Por Pagar',
}

export function generateReportExcel(data: ReportData): void {
  const wb = XLSX.utils.book_new()
  let wsData: (string | number)[][] = []
  let sheetName = SHEET_NAMES[data.tab] ?? 'Reporte'

  if (data.tab === 'sales') {
    wsData = [
      ['N° Nota', 'Fecha', 'Cliente', 'Tipo', 'Subtotal', 'IGV', 'Descuento', 'Total'],
      ...data.sales.map(s => [
        `${s.series}-${String(s.number).padStart(4, '0')}`,
        formatDateTime(s.created_at),
        s.customer_id ? (data.customerMap[s.customer_id] ?? '—') : 'Sin cliente',
        s.type === 'cash' ? 'Contado' : 'Crédito',
        s.subtotal, s.tax_amount, s.discount, s.total,
      ]),
      [],
      ['', '', '', 'TOTAL', '', '', '', data.sales.reduce((s, v) => s + v.total, 0)],
    ]
  } else if (data.tab === 'purchases') {
    wsData = [
      ['N° OC', 'Fecha', 'Proveedor', 'Estado', 'Subtotal', 'IGV', 'Total'],
      ...data.purchases.map(p => [
        `${p.series}-${String(p.number).padStart(4, '0')}`,
        formatDate(p.created_at),
        data.supplierMap[p.supplier_id] ?? '—',
        p.status === 'draft' ? 'Borrador' : p.status === 'sent' ? 'Enviada' : p.status === 'received' ? 'Recibida' : 'Cancelada',
        p.subtotal, p.tax_amount, p.total,
      ]),
      [],
      ['', '', '', 'TOTAL', '', '', data.purchases.reduce((s, p) => s + p.total, 0)],
    ]
  } else if (data.tab === 'inventory') {
    wsData = [
      ['SKU', 'Producto', 'Stock', 'Stock Mínimo', 'Precio Costo', 'Precio Venta', 'Valor Stock', 'Estado'],
      ...data.inventory.map(p => [
        p.sku ?? '—', p.name, p.stock,
        p.min_stock > 0 ? p.min_stock : 0,
        p.purchase_price, p.sale_price,
        p.stock * p.purchase_price,
        p.stock <= 0 ? 'Sin stock' : (p.min_stock > 0 && p.stock <= p.min_stock) ? 'Stock bajo' : 'OK',
      ]),
      [],
      ['', 'TOTAL', '', '', '', '', data.inventory.reduce((s, p) => s + p.stock * p.purchase_price, 0)],
    ]
  } else if (data.tab === 'receivables') {
    wsData = [
      ['Cliente', 'Fecha', 'Total', 'Cobrado', 'Saldo', 'Vence', 'Estado'],
      ...data.receivables.map(a => [
        data.customerMap[a.customer_id] ?? '—',
        formatDate(a.created_at),
        a.total_amount, a.paid_amount,
        a.total_amount - a.paid_amount,
        a.due_date ? formatDate(a.due_date) : '—',
        a.status === 'active' ? 'Pendiente' : a.status === 'overdue' ? 'Vencido' : 'Pagado',
      ]),
      [],
      ['TOTAL POR COBRAR', '', '', '', data.receivables.filter(a => a.status !== 'paid').reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)],
    ]
  } else if (data.tab === 'payables') {
    wsData = [
      ['Proveedor', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Vence', 'Estado'],
      ...data.payables.map(d => [
        data.supplierMap[d.supplier_id] ?? '—',
        formatDate(d.created_at),
        d.total_amount, d.paid_amount,
        d.total_amount - d.paid_amount,
        d.due_date ? formatDate(d.due_date) : '—',
        d.status === 'active' ? 'Pendiente' : d.status === 'overdue' ? 'Vencido' : 'Pagado',
      ]),
      [],
      ['TOTAL POR PAGAR', '', '', '', data.payables.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)],
    ]
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fileName = `${data.tab}-${formatDate(new Date(), 'yyyyMMdd')}.xlsx`
  XLSX.writeFile(wb, fileName)
}
