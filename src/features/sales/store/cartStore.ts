import { create } from 'zustand'
import type { CartItem, SaleType, PaymentMethod } from '../types'

interface CartState {
  items: CartItem[]
  customer_id: string | null
  customer_name: string | null
  type: SaleType
  payment_method: PaymentMethod
  discount: number   // descuento global en %
  freightCost: number
  notes: string
  saleDate: string  // YYYY-MM-DD
  advanceAmount: number
  advanceMethod: PaymentMethod

  // Acciones
  addItem: (item: Omit<CartItem, 'subtotal'>) => void
  updateQuantity: (productId: string, quantity: number) => void
  updatePrice: (productId: string, price: number) => void
  updateDiscount: (productId: string, discount: number) => void
  removeItem: (productId: string) => void
  setCustomer: (id: string | null, name: string | null) => void
  setType: (type: SaleType) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setGlobalDiscount: (discount: number) => void
  setFreightCost: (cost: number) => void
  setNotes: (notes: string) => void
  setSaleDate: (date: string) => void
  setAdvanceAmount: (amount: number) => void
  setAdvanceMethod: (method: PaymentMethod) => void
  clear: () => void
}

const today = () => new Date().toISOString().split('T')[0]

const DEFAULT_STATE = {
  items: [] as CartItem[],
  customer_id: null,
  customer_name: null,
  type: 'cash' as SaleType,
  payment_method: 'cash' as PaymentMethod,
  discount: 0,
  freightCost: 0,
  notes: '',
  saleDate: today(),
  advanceAmount: 0,
  advanceMethod: 'cash' as PaymentMethod,
}

export const useCartStore = create<CartState>((set, get) => ({
  ...DEFAULT_STATE,

  addItem: (item) => {
    const items = get().items
    const existing = items.find(i => i.product_id === item.product_id)
    if (existing) {
      set({
        items: items.map(i =>
          i.product_id === item.product_id
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                subtotal: (i.quantity + item.quantity) * i.unit_price * (1 - i.discount / 100),
              }
            : i
        ),
      })
    } else {
      const subtotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100)
      set({ items: [...items, { ...item, subtotal }] })
    }
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter(i => i.product_id !== productId) })
      return
    }
    set({
      items: get().items.map(i =>
        i.product_id === productId
          ? { ...i, quantity, subtotal: quantity * i.unit_price * (1 - i.discount / 100) }
          : i
      ),
    })
  },

  updatePrice: (productId, price) => {
    set({
      items: get().items.map(i =>
        i.product_id === productId
          ? { ...i, unit_price: price, subtotal: i.quantity * price * (1 - i.discount / 100) }
          : i
      ),
    })
  },

  updateDiscount: (productId, discount) => {
    set({
      items: get().items.map(i =>
        i.product_id === productId
          ? { ...i, discount, subtotal: i.quantity * i.unit_price * (1 - discount / 100) }
          : i
      ),
    })
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.product_id !== productId) })
  },

  setCustomer: (id, name) => set({ customer_id: id, customer_name: name }),
  setType: (type) => set({ type }),
  setPaymentMethod: (method) => set({ payment_method: method }),
  setGlobalDiscount: (discount) => set({ discount }),
  setFreightCost: (freightCost) => set({ freightCost }),
  setNotes: (notes) => set({ notes }),
  setSaleDate: (saleDate) => set({ saleDate }),
  setAdvanceAmount: (advanceAmount) => set({ advanceAmount }),
  setAdvanceMethod: (advanceMethod) => set({ advanceMethod }),
  clear: () => set({ ...DEFAULT_STATE, saleDate: today() }),
}))
