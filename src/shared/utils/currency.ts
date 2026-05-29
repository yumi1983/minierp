const symbol = import.meta.env.VITE_DEFAULT_CURRENCY_SYMBOL ?? 'S/'

export function formatCurrency(amount: number, currencySymbol = symbol): string {
  return `${currencySymbol} ${amount.toFixed(2)}`
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]/g, '')) || 0
}
