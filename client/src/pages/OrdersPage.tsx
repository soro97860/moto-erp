import { useState } from 'react';
import { useOrders, useCompleteOrder } from '../hooks/useOrders';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { WorkOrderViewer } from '../components/WorkOrderViewer';
import { Loader2, Eye, CheckCheck, Search } from 'lucide-react';
import { useToast } from '../components/ui/toast';
import { formatCurrency, formatDate } from '../lib/utils';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'destructive' }> = {
  PENDING:     { label: '待處理', variant: 'warning' },
  IN_PROGRESS: { label: '進行中', variant: 'info' },
  COMPLETED:   { label: '已完成', variant: 'success' },
  CANCELLED:   { label: '已取消', variant: 'destructive' },
};

const paymentLabels: Record<string, string> = {
  CASH: '現金',
  CARD: '刷卡',
  TRANSFER: '轉帳',
};

export function OrdersPage() {
  const { toast } = useToast();

  // Filters
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [status, setStatus] = useState('');
  const [plateInput, setPlateInput] = useState('');
  const [plateFilter, setPlateFilter] = useState('');
  const [page, setPage] = useState(1);

  // Viewer
  const [viewingId, setViewingId] = useState('');

  // Complete order
  const [completingId, setCompletingId] = useState('');
  const completeOrder = useCompleteOrder();

  const { data, isLoading } = useOrders({
    from, to,
    ...(status && { status }),
    ...(plateFilter && { licensePlate: plateFilter }),
    page: String(page),
    pageSize: '20',
  });

  async function handleComplete(id: string, paymentMethod: string) {
    try {
      await completeOrder.mutateAsync({ id, paymentMethod });
      setCompletingId('');
      toast('工單已完工', 'success');
    } catch {
      toast('完工失敗', 'error');
    }
  }

  function handlePlateSearch() {
    setPlateFilter(plateInput.trim().toUpperCase().replace(/\s/g, ''));
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">工單查詢</h2>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-40" />
        <span className="self-center text-gray-400">—</span>
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-40" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-36">
          <option value="">所有狀態</option>
          {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
        {/* License plate search */}
        <div className="flex gap-1">
          <Input
            placeholder="車牌查詢"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
            className="w-32 font-mono uppercase"
          />
          <Button variant="outline" size="sm" onClick={handlePlateSearch}>
            <Search className="h-4 w-4" />
          </Button>
          {plateFilter && (
            <Button variant="ghost" size="sm" onClick={() => { setPlateFilter(''); setPlateInput(''); setPage(1); }}>
              清除
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['工單號', '日期', '車主', '車牌', '操作員', '零件', '工資', '折扣', '總計', '狀態', '操作'].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={11} className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" /></td></tr>
              )}
              {data?.items.map((o) => {
                const s = statusMap[o.status] ?? { label: o.status, variant: 'outline' as const };
                const canComplete = o.status === 'PENDING' || o.status === 'IN_PROGRESS';
                const isThisCompleting = completingId === o.id;
                return [
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{o.orderNo}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{formatDate(o.createdAt, 'MM-DD HH:mm')}</td>
                    <td className="px-3 py-3">{o.customer?.name ?? '—'}</td>
                    <td className="px-3 py-3 font-mono text-xs">{o.customer?.licensePlate ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{o.operator.name}</td>
                    <td className="px-3 py-3">{formatCurrency(o.subtotal)}</td>
                    <td className="px-3 py-3">{formatCurrency(o.laborFee)}</td>
                    <td className="px-3 py-3 text-red-500">
                      {Number(o.discount) > 0 ? `-${formatCurrency(o.discount)}` : '—'}
                    </td>
                    <td className="px-3 py-3 font-semibold">{formatCurrency(o.total)}</td>
                    <td className="px-3 py-3">
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        {canComplete && (
                          <Button
                            variant={isThisCompleting ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setCompletingId(isThisCompleting ? '' : o.id)}
                          >
                            <CheckCheck className="h-3.5 w-3.5 mr-1" /> 完工
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-primary-600"
                          title="預覽工單"
                          onClick={() => setViewingId(o.id)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>,
                  // Inline payment selection row
                  isThisCompleting && (
                    <tr key={`${o.id}-pay`} className="bg-green-50 border-t-0">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700">選擇付款方式：</span>
                          {(['CASH', 'CARD', 'TRANSFER'] as const).map((pm) => (
                            <Button
                              key={pm}
                              size="sm"
                              className="h-8"
                              disabled={completeOrder.isPending}
                              onClick={() => handleComplete(o.id, pm)}
                            >
                              {completeOrder.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : paymentLabels[pm]}
                            </Button>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-gray-400"
                            onClick={() => setCompletingId('')}
                          >
                            取消
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
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
