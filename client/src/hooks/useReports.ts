import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import dayjs from 'dayjs';

export interface DailyReport {
  date: string;
  summary: {
    count: number;
    revenue: number;
    laborTotal: number;
    partsRevenue: number;
    discountTotal: number;
    partsCost: number;
    grossProfit: number;
  };
}

export interface PeriodReport {
  from: string;
  to: string;
  summary: {
    count: number;
    revenue: number;
    laborTotal: number;
    partsRevenue: number;
    discountTotal: number;
    partsCost: number;
    grossProfit: number;
  };
  dailyBreakdown: Array<{ day: string; count: number; revenue: number }>;
}

export interface InventoryReport {
  summary: {
    totalItems: number;
    totalStockValue: number;
    totalSellValue: number;
    lowStockItems: number;
    zeroStockItems: number;
  };
  products: Array<{
    id: string;
    sku: string;
    name: string;
    unit: string;
    stockQty: number;
    minStockQty: number;
    costPrice: string;
    sellPrice: string;
    brand: { name: string } | null;
    category: { name: string } | null;
  }>;
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ['report-daily', date],
    queryFn: async () => {
      const { data } = await api.get(`/reports/daily?date=${date}`);
      return data.data as DailyReport;
    },
    enabled: !!date,
  });
}

export function usePeriodReport(from: string, to: string) {
  return useQuery({
    queryKey: ['report-period', from, to],
    queryFn: async () => {
      const { data } = await api.get(`/reports/period?from=${from}&to=${to}`);
      return data.data as PeriodReport;
    },
    enabled: !!from && !!to,
  });
}

export function useInventoryReport() {
  return useQuery({
    queryKey: ['report-inventory'],
    queryFn: async () => {
      const { data } = await api.get('/reports/inventory');
      return data.data as InventoryReport;
    },
    staleTime: 60_000,
  });
}

export function useLast7Days() {
  const to = dayjs().format('YYYY-MM-DD');
  const from = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
  return usePeriodReport(from, to);
}

export function exportOrdersCSV(from: string, to: string) {
  const token = JSON.parse(localStorage.getItem('moto-auth') ?? '{}')?.state?.token;
  const url = `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/reports/export/orders?from=${from}&to=${to}`;
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('data-token', token ?? '');
  // Use fetch to handle auth header
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      a.href = blobUrl;
      a.download = `orders_${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    });
}
