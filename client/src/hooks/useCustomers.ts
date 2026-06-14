import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  licensePlate: string;
  vehicleModel: string | null;
  vehicleColor: string | null;
  note: string | null;
  createdAt: string;
}

export interface ServiceRecord {
  id: string;
  licensePlate: string;
  serviceDate: string;
  mileage: number | null;
  description: string;
  diagnosis: string | null;
  technician: { id: string; name: string } | null;
  orders: Array<{
    id: string;
    orderNo: string;
    total: string;
    status: string;
    items: Array<{
      qty: number;
      unitPrice: string;
      product: { name: string; sku: string; unit: string };
    }>;
  }>;
}

export function useCustomers(search = '') {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const { data } = await api.get(
        `/customers?search=${encodeURIComponent(search)}&pageSize=50`,
      );
      return data.data.items as Customer[];
    },
  });
}

export function useCustomerByPlate(plate: string) {
  return useQuery({
    queryKey: ['customer-plate', plate],
    queryFn: async () => {
      const { data } = await api.get(
        `/customers/plate/${encodeURIComponent(plate)}`,
      );
      return data.data as Customer[];
    },
    enabled: plate.length >= 2,
    retry: false,
  });
}

export function useCustomerHistory(customerId: string) {
  return useQuery({
    queryKey: ['customer-history', customerId],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${customerId}/history`);
      return data.data.items as ServiceRecord[];
    },
    enabled: !!customerId,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown) => {
      const { data } = await api.post('/customers', body);
      return data.data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string } & Record<string, unknown>) => {
      const { data } = await api.put(`/customers/${id}`, body);
      return data.data as Customer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
