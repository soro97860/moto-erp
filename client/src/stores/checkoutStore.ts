import { create } from 'zustand';
import type { Customer } from '../hooks/useCustomers';

interface CheckoutState {
  plateInput: string;
  plateQuery: string;
  manualCustomer: Customer | null;
  setPlateInput: (v: string) => void;
  setPlateQuery: (v: string) => void;
  setManualCustomer: (c: Customer | null) => void;
  resetPlate: () => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  plateInput: '',
  plateQuery: '',
  manualCustomer: null,
  setPlateInput: (v) => set({ plateInput: v }),
  setPlateQuery: (v) => set({ plateQuery: v }),
  setManualCustomer: (c) => set({ manualCustomer: c }),
  resetPlate: () => set({ plateInput: '', plateQuery: '', manualCustomer: null }),
}));
