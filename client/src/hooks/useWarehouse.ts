import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import dayjs from 'dayjs';

export interface StorageLocation {
  id: string;
  floor: string;
  cabinet: string;
  shelf: string;
  note: string | null;
  _count?: { products: number };
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; sku: string; name: string; unit: string };
  operator: { id: string; name: string };
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/warehouse/locations');
      return data.data as StorageLocation[];
    },
    staleTime: 60_000,
  });
}

export function useTodayMovements() {
  const today = dayjs().format('YYYY-MM-DD');
  return useQuery({
    queryKey: ['movements-today', today],
    queryFn: async () => {
      const { data } = await api.get(
        `/warehouse/movements?from=${today}&to=${today}&pageSize=50`,
      );
      return data.data.items as StockMovement[];
    },
    refetchInterval: 30_000,
  });
}

export function useMovements(
  filters: { productId?: string; type?: string; from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: ['movements', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.productId) params.set('productId', filters.productId);
      if (filters.type) params.set('type', filters.type);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      params.set('pageSize', '50');
      const { data } = await api.get(`/warehouse/movements?${params}`);
      return data.data.items as StockMovement[];
    },
  });
}

export function useLowStock(threshold?: number) {
  return useQuery({
    queryKey: ['low-stock', threshold],
    queryFn: async () => {
      const url =
        threshold !== undefined
          ? `/warehouse/low-stock?threshold=${threshold}`
          : '/warehouse/low-stock';
      const { data } = await api.get(url);
      return data.data as {
        total: number;
        threshold: number | null;
        items: Array<{
          id: string;
          sku: string;
          name: string;
          unit: string;
          stockQty: number;
          minStockQty: number;
          brand: { name: string } | null;
          storageLocation: StorageLocation | null;
        }>;
      };
    },
  });
}

export function useStockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      productId: string;
      qty: number;
      storageLocationId?: string;
      reason?: string;
    }) => {
      const { data } = await api.post('/warehouse/stock-in', payload);
      return data.data as StockMovement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements-today'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
    },
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      floor: string;
      cabinet: string;
      shelf: string;
      note?: string;
    }) => {
      const { data } = await api.post('/warehouse/locations', payload);
      return data.data as StorageLocation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['locations'] }),
  });
}
