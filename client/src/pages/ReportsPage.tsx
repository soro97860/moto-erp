import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, ShoppingBag, Users, DollarSign,
  Download, AlertTriangle, Loader2, RefreshCw,
} from 'lucide-react';
import {
  useDailyReport, useLast7Days, useInventoryReport, exportOrdersCSV,
} from '../hooks/useReports';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { useToast } from '../components/ui/toast';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import dayjs from 'dayjs';

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  title, value, sub, icon: Icon, color = 'blue',
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn('p-2.5 rounded-lg', colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function ReportsPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [exportFrom, setExportFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [exportTo, setExportTo] = useState(dayjs().format('YYYY-MM-DD'));

  const { data: daily, isLoading: dailyLoading, refetch: refetchDaily } = useDailyReport(selectedDate);
  const { data: period7, isLoading: periodLoading } = useLast7Days();
  const { data: inventory, isLoading: invLoading } = useInventoryReport();

  function handleExportCSV() {
    try {
      exportOrdersCSV(exportFrom, exportTo);
      toast('CSV 下載中…', 'info');
    } catch {
      toast('匯出失敗', 'error');
    }
  }

  const avg = daily?.summary
    ? daily.summary.count > 0
      ? formatCurrency(daily.summary.revenue / daily.summary.count)
      : '$0'
    : '—';

  // Recharts bar data
  const chartData = period7?.dailyBreakdown.map((d) => ({
    day: dayjs(d.day).format('MM/DD'),
    revenue: Number(d.revenue.toFixed(0)),
    count: d.count,
  })) ?? [];

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border rounded-lg shadow p-3 text-xs">
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-primary-600">營業額：{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">報表</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button variant="outline" size="icon" onClick={() => refetchDaily()} disabled={dailyLoading}>
            <RefreshCw className={cn('h-4 w-4', dailyLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ── Daily stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="今日營業額"
          value={daily?.summary ? formatCurrency(daily.summary.revenue) : '—'}
          sub={selectedDate}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="工單數"
          value={daily?.summary ? String(daily.summary.count) : '—'}
          sub="筆"
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          title="平均客單價"
          value={avg}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="毛利估算"
          value={daily?.summary ? formatCurrency(daily.summary.grossProfit) : '—'}
          sub={daily?.summary ? `工資 ${formatCurrency(daily.summary.laborTotal)}` : undefined}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* ── 7-day bar chart ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">近 7 日營業額趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          {periodLoading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="h-48 flex items-center justify-center text-sm text-gray-400">
              此區間無工單資料
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Inventory table ──────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">庫存現況</CardTitle>
            {inventory && (
              <div className="flex gap-3 text-xs text-gray-500">
                <span>成本總值 {formatCurrency(inventory.summary.totalStockValue)}</span>
                <span className="text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {inventory.summary.lowStockItems} 項低庫存
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['品名', '分類', '庫存', '下限', '成本值', '警示'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inventory?.products.map((p) => {
                    const isLow = p.stockQty <= p.minStockQty;
                    return (
                      <tr key={p.id} className={cn('hover:bg-gray-50', isLow && 'bg-red-50/40')}>
                        <td className="px-4 py-2.5 font-medium max-w-[160px] truncate">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{p.category?.name ?? '—'}</td>
                        <td className={cn('px-4 py-2.5 font-semibold', isLow ? 'text-red-600' : 'text-green-600')}>
                          {p.stockQty} {p.unit}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{p.minStockQty}</td>
                        <td className="px-4 py-2.5 text-gray-500">
                          {formatCurrency(Number(p.costPrice) * p.stockQty)}
                        </td>
                        <td className="px-4 py-2.5">
                          {isLow && (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertTriangle className="h-2.5 w-2.5" /> 低庫存
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Export ───────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">匯出資料</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">開始日期</label>
              <input
                type="date"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="h-9 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring block"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">結束日期</label>
              <input
                type="date"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="h-9 border rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring block"
              />
            </div>
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4" /> 匯出工單 CSV
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            匯出的 CSV 包含 UTF-8 BOM，可直接以 Excel 開啟。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
