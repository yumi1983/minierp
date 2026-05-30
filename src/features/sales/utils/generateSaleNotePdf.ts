import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from '@/shared/utils/date'
import { formatCurrency } from '@/shared/utils/currency'
import type { SaleWithItems } from '../types'
import type { CompanySettings } from '@/features/company/types'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  check: 'Cheque',
}

export async function generateSaleNotePdf(
  sale: SaleWithItems,
  productNames: Record<string, string>,
  customerName: string | null,
  company: CompanySettings | null,
  advanceAmount = 0,
  advanceMethod = '',
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // ── ENCABEZADO EMPRESA ────────────────────────────────────────────
  if (company?.logo_url) {
    try {
      await loadImageAsBase64(company.logo_url).then(b64 => {
        doc.addImage(b64, 'JPEG', margin, y, 30, 15)
      })
    } catch { /* continúa sin logo */ }
  }

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(company?.trade_name ?? 'Mi Empresa', pageW - margin, y + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100)
  if (company?.legal_name) doc.text(company.legal_name, pageW - margin, y + 9, { align: 'right' })
  if (company?.tax_id) doc.text(`RUC: ${company.tax_id}`, pageW - margin, y + 13, { align: 'right' })
  if (company?.address) doc.text(company.address, pageW - margin, y + 17, { align: 'right' })
  if (company?.phone) doc.text(`Tel: ${company.phone}`, pageW - margin, y + 21, { align: 'right' })
  doc.setTextColor(0)

  y += 28

  // ── TÍTULO DOCUMENTO ──────────────────────────────────────────────
  doc.setFillColor(30, 41, 59)
  doc.rect(margin, y, pageW - margin * 2, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('NOTA DE VENTA', pageW / 2, y + 7, { align: 'center' })
  doc.setTextColor(0)
  y += 14

  // ── DATOS DEL DOCUMENTO ───────────────────────────────────────────
  const docCode = `${sale.series}-${String(sale.number).padStart(4, '0')}`

  // Columna izquierda: cliente
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE', margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(customerName ?? 'Cliente general', margin, y + 9)

  // Columna derecha: datos venta
  const rightX = pageW / 2 + 10
  const rightRows = [
    ['N° Documento:', docCode],
    ['Fecha:', formatDate(sale.created_at)],
    ['Tipo:', sale.type === 'cash' ? 'Contado' : 'Crédito'],
    ['Pago:', sale.type === 'cash' ? (PAYMENT_LABELS[sale.payment_method ?? ''] ?? '—') : 'Crédito'],
  ]
  rightRows.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightX, y + 4 + i * 5)
    doc.setFont('helvetica', 'normal')
    doc.text(value, rightX + 30, y + 4 + i * 5)
  })

  y += 28

  // ── TABLA DE ÍTEMS ────────────────────────────────────────────────
  const tableBody = sale.items.map((item, idx) => [
    String(idx + 1),
    productNames[item.product_id] ?? '—',
    String(item.quantity),
    formatCurrency(item.unit_price),
    item.discount > 0 ? `${item.discount}%` : '—',
    formatCurrency(item.subtotal),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'DESCRIPCIÓN', 'CANT.', 'P. UNIT.', 'DSCTO.', 'SUBTOTAL']],
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 28 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // ── TOTALES ───────────────────────────────────────────────────────
  const taxLabel = company?.tax_label ?? 'IGV'
  const totalsX = pageW - margin - 70
  const totalsW = 70

  const totalsRows: [string, string][] = []
  if (sale.discount > 0) totalsRows.push(['Subtotal bruto:', formatCurrency(sale.subtotal + sale.discount)])
  if (sale.discount > 0) totalsRows.push(['Descuento:', `-${formatCurrency(sale.discount)}`])
  totalsRows.push(['Subtotal:', formatCurrency(sale.subtotal)])
  totalsRows.push([`${taxLabel} (${sale.tax_rate}%):`, formatCurrency(sale.tax_amount)])

  doc.setFontSize(8)
  totalsRows.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, totalsX + 2, y + 5 + i * 6)
    doc.text(value, totalsX + totalsW - 2, y + 5 + i * 6, { align: 'right' })
  })

  y += totalsRows.length * 6 + 2
  doc.setDrawColor(200)
  doc.line(totalsX, y + 2, totalsX + totalsW, y + 2)

  doc.setFillColor(30, 41, 59)
  doc.rect(totalsX, y + 3, totalsW, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL:', totalsX + 2, y + 8.5)
  doc.text(formatCurrency(sale.total), totalsX + totalsW - 2, y + 8.5, { align: 'right' })
  doc.setTextColor(0)

  y += 14

  // Adelanto y saldo (solo crédito con adelanto)
  if (sale.type === 'credit' && advanceAmount > 0) {
    const saldo = sale.total - advanceAmount
    const methodLabel = advanceMethod ? ` (${PAYMENT_LABELS[advanceMethod] ?? advanceMethod})` : ''

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(5, 150, 105) // emerald
    doc.text(`Adelanto a cuenta${methodLabel}:`, totalsX + 2, y + 5)
    doc.text(`-${formatCurrency(advanceAmount)}`, totalsX + totalsW - 2, y + 5, { align: 'right' })

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(185, 28, 28) // red
    doc.text('Saldo por cobrar:', totalsX + 2, y + 12)
    doc.text(formatCurrency(saldo), totalsX + totalsW - 2, y + 12, { align: 'right' })
    doc.setTextColor(0)

    y += 18
  } else {
    y += 4
  }

  // ── CRÉDITO ───────────────────────────────────────────────────────
  if (sale.type === 'credit') {
    const saldo = sale.total - (advanceAmount > 0 ? advanceAmount : 0)
    const bannerText = advanceAmount > 0
      ? `VENTA A CRÉDITO — Saldo por cobrar: ${formatCurrency(saldo)}`
      : `VENTA A CRÉDITO — Cuenta por cobrar: ${formatCurrency(sale.total)}`
    doc.setFillColor(254, 243, 199) // amber-100
    doc.setDrawColor(217, 119, 6)
    doc.rect(margin, y, pageW - margin * 2, 10, 'FD')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(146, 64, 14)
    doc.text(bannerText, pageW / 2, y + 6.5, { align: 'center' })
    doc.setTextColor(0)
    y += 14
  }

  // ── NOTAS ─────────────────────────────────────────────────────────
  if (sale.notes) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', margin, y)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(sale.notes, pageW - margin * 2)
    doc.text(lines, margin, y + 5)
    y += 5 + lines.length * 4
  }

  // ── FIRMA ─────────────────────────────────────────────────────────
  y += 10
  const sigW = 55
  const sigY = y
  // Vendedor
  doc.setDrawColor(150)
  doc.line(margin, sigY, margin + sigW, sigY)
  doc.setFontSize(7)
  doc.setTextColor(100)
  doc.text('Vendedor', margin + sigW / 2, sigY + 4, { align: 'center' })

  // Cliente
  const sig2X = pageW - margin - sigW
  doc.line(sig2X, sigY, sig2X + sigW, sigY)
  doc.text('Cliente / Recibido por', sig2X + sigW / 2, sigY + 4, { align: 'center' })

  // ── PIE ───────────────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text(
    `Documento generado el ${formatDate(new Date())} — ${company?.trade_name ?? ''}`,
    pageW / 2, pageH - 8,
    { align: 'center' }
  )

  doc.save(`NV-${docCode}-${formatDate(sale.created_at, 'yyyyMMdd')}.pdf`)
}

function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/jpeg'))
    }
    img.onerror = reject
    img.src = url
  })
}
