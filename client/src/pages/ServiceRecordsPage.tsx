import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import dayjs from 'dayjs';

export function ServiceRecordsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['service-records', search, page],
    queryFn: () => api.get(`/service-records?search=${search}&page=${page}&pageSize=20`),
  });

  const result = data?.data?.data;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">維修紀錄</h2>
      <div className="mb-4">
        <input
          type="text"
          placeholder="搜尋車牌、車主、描述…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['日期', '車主', '車牌', '維修內容', '技師', '里程'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">載入中…</td></tr>}
              {result?.items?.map((r: Record<string, unknown>) => (
                <tr key={r.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{dayjs(r.serviceDate as string).format('YYYY-MM-DD')}</td>
                  <td className="px-4 py-3">{(r.customer as Record<string, string>)?.name}</td>
                  <td className="px-4 py-3 font-mono">{r.licensePlate as string}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{r.description as string}</td>
                  <td className="px-4 py-3 text-gray-500">{(r.technician as Record<string, string> | null)?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.mileage != null ? `${r.mileage} km` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>共 {result.total} 筆</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border disabled:opacity-40">上一頁</button>
              <span>第 {page} / {result.totalPages} 頁</span>
              <button onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))} disabled={page >= result.totalPages} className="px-2 py-1 rounded border disabled:opacity-40">下一頁</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
