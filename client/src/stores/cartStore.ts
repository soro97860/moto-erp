import { create } from 'zustand';

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  discount: number;
  stock: number;
}

interface CartState {
  items: CartItem[];
  laborFee: number;
  discount: number;
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  setQty: (productId: string, qty: number) => void;
  setDiscount: (productId: string, discount: number) => void;
  removeItem: (productId: string) => void;
  setLaborFee: (fee: number) => void;
  setOrderDiscount: (discount: number) => void;
  clear: () => void;
  subtotal: () => number;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  laborFee: 0,
  discount: 0,

  addItem: (item) => {
    const existing = get().items.find((i) => i.productId === item.productId);
    if (existing) {
      set((s) => ({
        items: s.items.map((i) =>
          i.productId === item.productId
            ? { ...i, qty: Math.min(i.qty + 1, i.stock) }
            : i,
        ),
      }));
    } else {
      set((s) => ({ items: [...s.items, { ...item, qty: 1 }] }));
    }
  },

  setQty: (productId, qty) => {
    if (qty <= 0) {
      set((s) => ({ items: s.items.filter((i) => i.productId !== productId) }));
    } else {
      set((s) => ({
        items: s.items.map((i) =>
          i.productId === productId ? { ...i, qty: Math.min(qty, i.stock) } : i,
        ),
      }));
    }
  },

  setDiscount: (productId, discount) =>
    set((s) => ({
      items: s.items.map((i) =>
        i.productId === productId ? { ...i, discount } : i,
      ),
    })),

  removeItem: (productId) =>
    set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

  setLaborFee: (laborFee) => set({ laborFee }),
  setOrderDiscount: (discount) => set({ discount }),
  clear: () => set({ items: [], laborFee: 0, discount: 0 }),

  subtotal: () =>
    get().items.reduce((s, i) => s + i.unitPrice * i.qty - i.discount, 0),

  total: () => get().subtotal() + get().laborFee - get().discount,
}));
