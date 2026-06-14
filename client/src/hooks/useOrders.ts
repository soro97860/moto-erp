import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

export interface OrderItem {
  productId: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

export interface CreateOrderPayload {
  customerId: string;
  laborFee: number;
  discount: number;
  note?: string;
  service?: {
    licensePlate: string;
    description: string;
    serviceDate?: string;
    mileage?: number;
  };
  items: OrderItem[];
}

export interface Order {
  id: string;
  orderNo: string;
  status: string;
  total: string;
  subtotal: string;
  laborFee: string;
  discount: string;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  customer: { id: string; name: string; phone: string; licensePlate: string };
  operator: { id: string; name: string };
  items: Array<{
    qty: number;
    unitPrice: string;
    discount: string;
    subtotal: string;
    product: { id: string; name: string; sku: string; unit: string };
  }>;
}

export interface Receipt {
  id: string;
  orderNo: string;
  issuedAt: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    licensePlate: string;
    vehicleModel: string | null;
    vehicleColor: string | null;
  };
  operator: string;
  items: Array<{
    sku: string;
    name: string;
    unit: string;
    qty: number;
    unitPrice: number;
    discount: number;
    subtotal: number;
  }>;
  laborFee: number;
  subtotal: number;
  discount: number;
  total: number;
  note: string | null;
  serviceDescription: string | null;
}

export function useOrders(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const { data } = await api.get(`/orders?${params}`);
      return data.data as {
        items: Order[];
        total: number;
        page: number;
        totalPages: number;
      };
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}`);
      return data.data as Order;
    },
    enabled: !!id,
  });
}

export function useOrderReceipt(id: string) {
  return useQuery({
    queryKey: ['order-receipt', id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/${id}/receipt`);
      return data.data as Receipt;
    },
    enabled: !!id,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrderPayload) => {
      const { data } = await api.post('/orders', payload);
      return data.data as Order;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCompleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
    }: {
      id: string;
      paymentMethod: string;
    }) => {
      const { data } = await api.put(`/orders/${id}/complete`, { paymentMethod });
      return data.data as { order: Order; paymentMethod: string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['order', vars.id] });
    },
  });
}
