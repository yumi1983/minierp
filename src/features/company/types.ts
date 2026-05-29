export interface CompanySettings {
  id: string
  org_id: string
  trade_name: string | null
  legal_name: string | null
  tax_id: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  currency: string
  currency_symbol: string
  tax_rate: number
  tax_label: string
  invoice_series: string
  receipt_series: string
  po_series: string
  created_at: string
  updated_at: string
}

export type UpdateCompanyDto = Omit<CompanySettings, 'id' | 'org_id' | 'created_at' | 'updated_at'>
