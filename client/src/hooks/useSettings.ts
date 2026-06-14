import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

// ── Types ────────────────────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'MECHANIC' | 'CASHIER';
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface BrandRecord {
  id: string;
  name: string;
  note: string | null;
}

export interface CategoryRecord {
  id: string;
  name: string;
  parentId: string | null;
  children?: CategoryRecord[];
}

export interface StorageLocationRecord {
  id: string;
  floor: string;
  cabinet: string;
  shelf: string;
  note: string | null;
  _count?: { products: number };
}

// ── Shop Settings ────────────────────────────────────────────────────────────
export function useShopSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, string>;
    },
  });
}

export function useUpdateShopSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      await api.put('/settings', payload);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
}

// ── Users ────────────────────────────────────────────────────────────────────
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.data as UserRecord[];
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      username: string;
      password: string;
      name: string;
      role: string;
      phone?: string;
    }) => {
      const { data } = await api.post('/users', payload);
      return data.data as UserRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      phone?: string | null;
      role?: string;
      password?: string;
    }) => {
      const { data } = await api.put(`/users/${id}`, payload);
      return data.data as UserRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/users/${id}/toggle`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ── Brands ───────────────────────────────────────────────────────────────────
export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data } = await api.get('/brands');
      return data.data as BrandRecord[];
    },
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; note?: string }) => {
      const { data } = await api.post('/brands', payload);
      return data.data as BrandRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/brands/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brands'] }),
  });
}

// ── Categories ───────────────────────────────────────────────────────────────
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data as CategoryRecord[];
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; parentId?: string | null }) => {
      const { data } = await api.post('/categories', payload);
      return data.data as CategoryRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

// ── Storage Locations ────────────────────────────────────────────────────────
export function useStorageLocations() {
  return useQuery({
    queryKey: ['storage-locations'],
    queryFn: async () => {
      const { data } = await api.get('/storage-locations');
      return data.data as StorageLocationRecord[];
    },
  });
}

export function useCreateStorageLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { floor: string; cabinet: string; shelf: string; note?: string }) => {
      const { data } = await api.post('/storage-locations', payload);
      return data.data as StorageLocationRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage-locations'] }),
  });
}

export function useBatchCreateStorageLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locations: Array<{ floor: string; cabinet: string; shelf: string }>) => {
      const { data } = await api.post('/storage-locations/batch', { locations });
      return data.data as { count: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage-locations'] }),
  });
}

export function useDeleteStorageLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/storage-locations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['storage-locations'] }),
  });
}
