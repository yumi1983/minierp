import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDate } from '@/shared/utils/date'
import { formatCurrency } from '@/shared/utils/currency'
import type { PurchaseOrderWithItems } from '../types'
import type { CompanySettings } from '@/features/company/types'

const STATUS_LABELS: Record<string, string> = {
  draft: 'BORRADOR',
  sent: 'ENVIADA',
  received: 'RECIBIDA',
  cancelled: 'CANCELADA',
}

export async function generatePurchaseOrderPdf(
  order: PurchaseOrderWithItems,
  productNames: Record<string, string>,
  supplierName: string,
  company: CompanySettings | null
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = margin

  // ── ENCABEZADO EMPRESA ─────────────────────────────────────────────
  // Logo (si existe)
  if (company?.logo_url) {
    try {
      await loadImageAsBase64(company.logo_url).then(b64 => {
        doc.addImage(b64, 'JPEG', margin, y, 30, 15)
      })
    } catch { /* si falla el logo, continúa sin él */ }
  }

  // Datos de la empresa (derecha)
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
  doc.setFillColor(30, 41, 59) // slate-800
  doc.rect(margin, y, pageW - margin * 2, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDEN DE COMPRA', pageW / 2, y + 7, { align: 'center' })
  doc.setTextColor(0)
  y += 14

  // ── DATOS DE LA ORDEN ─────────────────────────────────────────────
  const orderCode = `${order.series}-${String(order.number).padStart(4, '0')}`

  // Columna izquierda: proveedor
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('PROVEEDOR', margin, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(supplierName, margin, y + 9)

  // Columna derecha: datos orden
  const rightX = pageW / 2 + 10
  const dataRows = [
    ['N° Orden:', orderCode],
    ['Fecha:', formatDate(order.created_at)],
    ['F. Entrega:', order.expected_date ? formatDate(order.expected_date) : '—'],
    ['Estado:', STATUS_LABELS[order.status] ?? order.status],
  ]

  dataRows.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(label, rightX, y + 4 + i * 5)
    doc.setFont('helvetica', 'normal')
    doc.text(value, rightX + 28, y + 4 + i * 5)
  })

  y += 28

  // ── TABLA DE ÍTEMS ────────────────────────────────────────────────
  const tableBody = order.items.map((item, idx) => [
    String(idx + 1),
    productNames[item.product_id] ?? item.product_id,
    String(item.quantity),
    formatCurrency(item.unit_price),
    formatCurrency(item.subtotal),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'PRODUCTO', 'CANT.', 'P. UNITARIO', 'SUBTOTAL']],
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
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // ── TOTALES ───────────────────────────────────────────────────────
  const totalsX = pageW - margin - 70
  const totalsW = 70

  const taxLabel = company?.tax_label ?? 'IGV'
  const taxRate = order.subtotal > 0
    ? Math.round((order.tax_amount / order.subtotal) * 100)
    : 0

  const totals = [
    ['Subtotal:', formatCurrency(order.subtotal)],
    [`${taxLabel} (${taxRate}%):`, formatCurrency(order.tax_amount)],
  ]

  doc.setFontSize(8)
  totals.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'normal')
    doc.text(label, totalsX + 2, y + 5 + i * 6)
    doc.text(value, totalsX + totalsW - 2, y + 5 + i * 6, { align: 'right' })
  })

  y += totals.length * 6 + 2
  // Línea separadora
  doc.setDrawColor(200)
  doc.line(totalsX, y + 2, totalsX + totalsW, y + 2)

  // Total final con fondo
  doc.setFillColor(30, 41, 59)
  doc.rect(totalsX, y + 3, totalsW, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL:', totalsX + 2, y + 8.5)
  doc.text(formatCurrency(order.total), totalsX + totalsW - 2, y + 8.5, { align: 'right' })
  doc.setTextColor(0)

  y += 18

  // ── NOTAS ─────────────────────────────────────────────────────────
  if (order.notes) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Notas:', margin, y)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(order.notes, pageW - margin * 2)
    doc.text(lines, margin, y + 5)
    y += 5 + lines.length * 4
  }

  // ── PIE DE PÁGINA ─────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7)
  doc.setTextColor(150)
  doc.text(
    `Generado el ${formatDate(new Date())} — ${company?.trade_name ?? ''}`,
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  )

  // ── GUARDAR ───────────────────────────────────────────────────────
  doc.save(`OC-${orderCode}-${formatDate(order.created_at, 'yyyyMMdd')}.pdf`)
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
