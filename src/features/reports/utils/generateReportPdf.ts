import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
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

const TITLES: Record<string, string> = {
  sales: 'REPORTE DE VENTAS',
  purchases: 'REPORTE DE COMPRAS',
  inventory: 'REPORTE DE INVENTARIO',
  receivables: 'CUENTAS POR COBRAR',
  payables: 'CUENTAS POR PAGAR',
}

export async function generateReportPdf(data: ReportData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // Header
  doc.setFillColor(30, 41, 59)
  doc.rect(margin, y, pageW - margin * 2, 12, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(TITLES[data.tab] ?? 'REPORTE', pageW / 2, y + 8.5, { align: 'center' })
  doc.setTextColor(0)
  y += 16

  if (data.tab !== 'inventory' && data.tab !== 'receivables' && data.tab !== 'payables') {
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Período: ${formatDate(data.range.from)} al ${formatDate(data.range.to)}`, margin, y)
    doc.text(`Generado: ${formatDateTime(new Date())}`, pageW - margin, y, { align: 'right' })
    doc.setTextColor(0)
    y += 6
  }

  if (data.tab === 'sales') {
    const total = data.sales.reduce((s, v) => s + v.total, 0)
    doc.setFontSize(8)
    doc.text(`Total ventas: ${formatCurrency(total)} | N° ventas: ${data.sales.length}`, margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['N° Nota', 'Fecha', 'Cliente', 'Tipo', 'Subtotal', 'IGV', 'Descuento', 'Total']],
      body: data.sales.map(s => [
        `${s.series}-${String(s.number).padStart(4, '0')}`,
        formatDateTime(s.created_at),
        s.customer_id ? (data.customerMap[s.customer_id] ?? '—') : 'Sin cliente',
        s.type === 'cash' ? 'Contado' : 'Crédito',
        formatCurrency(s.subtotal),
        formatCurrency(s.tax_amount),
        s.discount > 0 ? formatCurrency(s.discount) : '—',
        formatCurrency(s.total),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right', fontStyle: 'bold' } },
    })
  } else if (data.tab === 'purchases') {
    const total = data.purchases.reduce((s, p) => s + p.total, 0)
    doc.setFontSize(8)
    doc.text(`Total compras: ${formatCurrency(total)} | N° órdenes: ${data.purchases.length}`, margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['N° OC', 'Fecha', 'Proveedor', 'Estado', 'Subtotal', 'IGV', 'Total']],
      body: data.purchases.map(p => [
        `${p.series}-${String(p.number).padStart(4, '0')}`,
        formatDate(p.created_at),
        data.supplierMap[p.supplier_id] ?? '—',
        p.status === 'draft' ? 'Borrador' : p.status === 'sent' ? 'Enviada' : p.status === 'received' ? 'Recibida' : 'Cancelada',
        formatCurrency(p.subtotal),
        formatCurrency(p.tax_amount),
        formatCurrency(p.total),
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
    })
  } else if (data.tab === 'inventory') {
    const totalValue = data.inventory.reduce((s, p) => s + p.stock * p.purchase_price, 0)
    doc.setFontSize(8)
    doc.text(`Productos activos: ${data.inventory.length} | Valor total: ${formatCurrency(totalValue)}`, margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['SKU', 'Producto', 'Stock', 'Mínimo', 'P. Costo', 'P. Venta', 'Valor stock', 'Estado']],
      body: data.inventory.map(p => [
        p.sku ?? '—',
        p.name,
        p.stock,
        p.min_stock > 0 ? p.min_stock : '—',
        formatCurrency(p.purchase_price),
        formatCurrency(p.sale_price),
        formatCurrency(p.stock * p.purchase_price),
        p.stock <= 0 ? 'Sin stock' : (p.min_stock > 0 && p.stock <= p.min_stock) ? 'Stock bajo' : 'OK',
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    })
  } else if (data.tab === 'receivables') {
    const pending = data.receivables.filter(a => a.status !== 'paid').reduce((s, a) => s + (a.total_amount - a.paid_amount), 0)
    doc.setFontSize(8)
    doc.text(`Total por cobrar: ${formatCurrency(pending)}`, margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Cliente', 'Fecha', 'Total', 'Cobrado', 'Saldo', 'Vence', 'Estado']],
      body: data.receivables.map(a => [
        data.customerMap[a.customer_id] ?? '—',
        formatDate(a.created_at),
        formatCurrency(a.total_amount),
        formatCurrency(a.paid_amount),
        formatCurrency(a.total_amount - a.paid_amount),
        a.due_date ? formatDate(a.due_date) : '—',
        a.status === 'active' ? 'Pendiente' : a.status === 'overdue' ? 'Vencido' : 'Pagado',
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    })
  } else if (data.tab === 'payables') {
    const pending = data.payables.filter(d => d.status !== 'paid').reduce((s, d) => s + (d.total_amount - d.paid_amount), 0)
    doc.setFontSize(8)
    doc.text(`Total por pagar: ${formatCurrency(pending)}`, margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Proveedor', 'Fecha', 'Total', 'Pagado', 'Saldo', 'Vence', 'Estado']],
      body: data.payables.map(d => [
        data.supplierMap[d.supplier_id] ?? '—',
        formatDate(d.created_at),
        formatCurrency(d.total_amount),
        formatCurrency(d.paid_amount),
        formatCurrency(d.total_amount - d.paid_amount),
        d.due_date ? formatDate(d.due_date) : '—',
        d.status === 'active' ? 'Pendiente' : d.status === 'overdue' ? 'Vencido' : 'Pagado',
      ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 7 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' } },
    })
  }

  const fileName = `${data.tab}-${formatDate(new Date(), 'yyyyMMdd')}.pdf`
  doc.save(fileName)
}
