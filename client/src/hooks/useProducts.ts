import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  sellPrice: string;
  costPrice: string;
  stockQty: number;
  minStockQty: number;
  isActive: boolean;
  brand: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  storageLocation: { id: string; floor: string; cabinet: string; shelf: string } | null;
}

interface ProductsFilter {
  keyword?: string;
  brand?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

export function useProducts(filter: ProductsFilter = {}) {
  return useQuery({
    queryKey: ['products', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter.keyword) params.set('keyword', filter.keyword);
      if (filter.brand) params.set('brand', filter.brand);
      if (filter.category) params.set('category', filter.category);
      params.set('page', String(filter.page ?? 1));
      params.set('pageSize', String(filter.pageSize ?? 20));
      const { data } = await api.get(`/products?${params}`);
      return data.data as {
        items: Product[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    },
  });
}

export function useProductByBarcode(barcode: string) {
  return useQuery({
    queryKey: ['product-barcode', barcode],
    queryFn: async () => {
      const { data } = await api.get(`/products/barcode/${encodeURIComponent(barcode)}`);
      return data.data as Product;
    },
    enabled: barcode.length > 0,
    retry: false,
  });
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await api.get('/brands');
      return data.data as { id: string; name: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as { id: string; name: string; children: { id: string; name: string }[] }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown) => {
      const { data } = await api.post('/products', body);
      return data.data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const { data } = await api.put(`/products/${id}`, body);
      return data.data as Product;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useImportProducts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: unknown[]) => {
      const { data } = await api.post('/products/import', { items });
      return data.data as { created: number; updated: number; total: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
