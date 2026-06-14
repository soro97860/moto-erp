import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/axios';
import dayjs from 'dayjs';

const typeLabel: Record<string, string> = { IN: '入庫', OUT: '出庫', ADJUSTMENT: '調整' };
const typeColor: Record<string, string> = {
  IN: 'bg-green-100 text-green-700',
  OUT: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-700',
};

export function StockPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', page],
    queryFn: () => api.get(`/stock/movements?page=${page}&pageSize=30`),
  });

  const result = data?.data?.data;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">庫存異動紀錄</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['時間', '零件', '類型', '數量', '異動前', '異動後', '原因', '操作員'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">載入中…</td></tr>}
              {result?.items?.map((m: Record<string, unknown>) => (
                <tr key={m.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs">{dayjs(m.createdAt as string).format('MM-DD HH:mm')}</td>
                  <td className="px-4 py-3">{(m.product as Record<string, string>)?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[m.type as string]}`}>
                      {typeLabel[m.type as string]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{m.qty as number}</td>
                  <td className="px-4 py-3 text-gray-500">{m.qtyBefore as number}</td>
                  <td className="px-4 py-3 text-gray-500">{m.qtyAfter as number}</td>
                  <td className="px-4 py-3 text-gray-500">{(m.reason as string) ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{(m.operator as Record<string, string>)?.name}</td>
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
