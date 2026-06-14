import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';

interface Stats {
  customers: number;
  products: number;
  ordersToday: number;
  lowStock: number;
}

export function DashboardPage() {
  const { data: customers } = useQuery({ queryKey: ['customers-count'], queryFn: () => api.get('/customers?pageSize=1') });
  const { data: products } = useQuery({ queryKey: ['products-count'], queryFn: () => api.get('/products?pageSize=1') });
  const { data: orders } = useQuery({ queryKey: ['orders-count'], queryFn: () => api.get('/orders?pageSize=1') });

  const stats = [
    { label: '車主數', value: customers?.data?.data?.total ?? '—' },
    { label: '零件種類', value: products?.data?.data?.total ?? '—' },
    { label: '工單總數', value: orders?.data?.data?.total ?? '—' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">儀表板</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-3xl font-bold mt-1 text-primary-600">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
