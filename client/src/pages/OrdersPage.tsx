import { useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { WorkOrderViewer } from '../components/WorkOrderViewer';
import { Loader2, Eye } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' }> = {
  PENDING:     { label: '待處理', variant: 'warning' },
  IN_PROGRESS: { label: '進行中', variant: 'info' },
  COMPLETED:   { label: '已完成', variant: 'success' },
  CANCELLED:   { label: '已取消', variant: 'destructive' },
};

export function OrdersPage() {
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [viewingId, setViewingId] = useState('');

  const { data, isLoading } = useOrders({
    from, to, ...(status && { status }), page: String(page), pageSize: '20',
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">工單查詢</h2>

      <div className="flex flex-wrap gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <span className="self-center text-gray-400">—</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
          <option value="">所有狀態</option>
          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['工單號', '日期', '車主', '車牌', '操作員', '零件', '工資', '折扣', '總計', '狀態', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={11} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></td></tr>
              )}
              {data?.items.map((o) => {
                const s = statusMap[o.status] ?? { label: o.status, variant: 'outline' as const };
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.orderNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(o.createdAt, 'MM-DD HH:mm')}</td>
                    <td className="px-4 py-3">{o.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{o.customer?.licensePlate ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{o.operator.name}</td>
                    <td className="px-4 py-3">{formatCurrency(o.subtotal)}</td>
                    <td className="px-4 py-3">{formatCurrency(o.laborFee)}</td>
                    <td className="px-4 py-3 text-red-500">
                      {Number(o.discount) > 0 ? `-${formatCurrency(o.discount)}` : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(o.total)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-primary-600"
                        title="預覽工單"
                        onClick={() => setViewingId(o.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-500">
            <span>共 {data.total} 筆</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>上一頁</Button>
              <span>第 {page} / {data.totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}>下一頁</Button>
            </div>
          </div>
        )}
      </div>

      <WorkOrderViewer
        orderId={viewingId}
        open={!!viewingId}
        onClose={() => setViewingId('')}
      />
    </div>
  );
}
