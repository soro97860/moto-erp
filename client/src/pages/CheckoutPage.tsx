import { useState, useRef, useCallback } from 'react';
import { Search, Trash2, Plus, Minus, Loader2, ScanLine, UserPlus } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useProducts } from '../hooks/useProducts';
import { useCustomerByPlate, useCreateCustomer } from '../hooks/useCustomers';
import { useCheckoutStore } from '../stores/checkoutStore';
import { useCreateOrder } from '../hooks/useOrders';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { PlateScanner } from '../components/PlateScanner';
import { WorkOrderViewer } from '../components/WorkOrderViewer';
import { cn, formatCurrency } from '../lib/utils';

export function CheckoutPage() {
  const { user } = useAuthStore();
  const cart = useCartStore();
  const { toast } = useToast();

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Customer — plate state lives in Zustand so it survives navigation
  const {
    plateInput, plateQuery, manualCustomer,
    setPlateInput, setPlateQuery, setManualCustomer, resetPlate,
  } = useCheckoutStore();
  const [scannerOpen, setScannerOpen] = useState(false);
  // Quick-add form
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qf, setQf] = useState({ name: '', phone: '', vehicleModel: '', vehicleColor: '' });

  // No-plate toggle (employee opts out of plate requirement)
  const [noPlate, setNoPlate] = useState(false);

  // Service description
  const [description, setDescription] = useState('');

  // Receipt / work order viewer
  const [completedOrderId, setCompletedOrderId] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  const { data: searchResults, isFetching: searching } = useProducts(
    searchActive && searchQuery.length >= 1 ? { keyword: searchQuery, pageSize: 8 } : {},
  );

  const { data: customers } = useCustomerByPlate(plateQuery);
  // Single match → auto-select; multiple → show list; manual (created/picked) → override
  const customer = manualCustomer ?? (customers?.length === 1 ? customers[0] : undefined);
  const notFound = !noPlate && plateQuery.length >= 2 && customers !== undefined && customers.length === 0 && !manualCustomer;

  const createCustomer = useCreateCustomer();

  const createOrder = useCreateOrder();

  const handleProductSelect = useCallback(
    (p: NonNullable<typeof searchResults>['items'][0]) => {
      cart.addItem({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        unitPrice: Number(p.sellPrice),
        discount: 0,
        stock: p.stockQty,
      });
      setSearchQuery('');
      setSearchActive(false);
      toast(`已加入：${p.name}`, 'success');
    },
    [cart, toast],
  );

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchResults?.items.length === 1) {
      handleProductSelect(searchResults.items[0]);
    }
    if (e.key === 'Escape') {
      setSearchActive(false);
      setSearchQuery('');
    }
  };

  const handlePlateSearch = () => {
    setManualCustomer(null);
    setShowQuickAdd(false);
    setQf({ name: '', phone: '', vehicleModel: '', vehicleColor: '' });
    setPlateQuery(plateInput.trim().toUpperCase().replace(/\s/g, ''));
  };

  async function handleQuickAdd() {
    if (!qf.name.trim() || !qf.phone.trim()) {
      toast('姓名和電話為必填', 'error');
      return;
    }
    try {
      const created = await createCustomer.mutateAsync({
        name: qf.name.trim(),
        phone: qf.phone.trim(),
        licensePlate: plateQuery,
        vehicleModel: qf.vehicleModel.trim() || undefined,
        vehicleColor: qf.vehicleColor.trim() || undefined,
      });
      setManualCustomer(created);
      setShowQuickAdd(false);
      setQf({ name: '', phone: '', vehicleModel: '', vehicleColor: '' });
      toast(`已新增車主：${created.name}`, 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '新增失敗', 'error');
    }
  }

  async function handleCheckout() {
    if (cart.items.length === 0) {
      toast('購物車是空的', 'error');
      return;
    }
    if (!noPlate && !customer) {
      toast('請先查詢車主', 'error');
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        customerId: noPlate ? undefined : customer!.id,
        laborFee: cart.laborFee,
        discount: cart.discount,
        note: description || undefined,
        service: !noPlate && customer && description
          ? {
              licensePlate: customer.licensePlate,
              description,
              serviceDate: new Date().toISOString(),
            }
          : undefined,
        items: cart.items.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          unitPrice: i.unitPrice,
          discount: i.discount,
        })),
      });

      setCompletedOrderId(order.id);
      setShowReceipt(true);
      cart.clear();
      setDescription('');
      setNoPlate(false);
      resetPlate();
      toast('結帳成功！', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '結帳失敗', 'error');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* ── Left panel: search + cart ─────────────────────── */}
      <div className="flex-1 space-y-4">
        <h2 className="text-xl font-bold">結帳</h2>

        {/* Barcode / keyword search */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSearchActive(e.target.value.length > 0);
                }}
                onKeyDown={handleSearchKey}
                onFocus={() => setSearchActive(searchQuery.length > 0)}
                placeholder="輸入條碼或商品名稱（Enter 快速加入）"
                className="pl-9"
              />
            </div>
          </div>

          {/* Search dropdown */}
          {searchActive && searchResults && (
            <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {searching && (
                <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> 搜尋中…
                </div>
              )}
              {!searching && searchResults.items.length === 0 && (
                <p className="p-3 text-sm text-gray-500">無符合商品</p>
              )}
              {searchResults.items.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-4"
                  onClick={() => handleProductSelect(p)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(p.sellPrice)}</p>
                    <p className={cn('text-xs', p.stockQty <= 5 ? 'text-red-500 font-medium' : 'text-gray-400')}>
                      庫存 {p.stockQty} {p.unit}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="bg-white rounded-xl border divide-y">
          {cart.items.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              尚未加入商品，請使用上方搜尋列
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.sku}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => cart.setQty(item.productId, item.qty - 1)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={item.stock}
                    value={item.qty}
                    onChange={(e) => cart.setQty(item.productId, Number(e.target.value))}
                    className="w-12 text-center text-sm border rounded px-1 py-0.5"
                  />
                  <button
                    onClick={() => cart.setQty(item.productId, item.qty + 1)}
                    className="p-1 rounded hover:bg-gray-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-medium">
                  {formatCurrency(item.unitPrice * item.qty)}
                </p>
                <button
                  onClick={() => cart.removeItem(item.productId)}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Repair description */}
        <div>
          <label className="block text-sm font-medium mb-1.5">維修說明</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="本次維修項目說明…（選填）"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
        </div>
      </div>

      {/* ── Right panel: customer + totals ───────────────── */}
      <div className="lg:w-72 xl:w-80 space-y-4">
        {/* License plate lookup */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">車主查詢</h3>
            <button
              onClick={() => setNoPlate(!noPlate)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              <span
                className={cn(
                  'relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors',
                  noPlate ? 'bg-orange-400' : 'bg-gray-200',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform',
                    noPlate ? 'translate-x-3' : 'translate-x-0',
                  )}
                />
              </span>
              無需車牌
            </button>
          </div>
          <div className={cn('flex gap-2', noPlate && 'opacity-40 pointer-events-none')}>
            <Input
              value={plateInput}
              onChange={(e) => { setPlateInput(e.target.value.toUpperCase()); setManualCustomer(null); setShowQuickAdd(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
              placeholder="輸入車牌號碼"
              className="font-mono text-sm uppercase"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setScannerOpen(true)}
              title="掃描車牌"
              className="shrink-0 gap-1 px-2.5"
            >
              <ScanLine className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">掃描</span>
            </Button>
            <Button size="sm" onClick={handlePlateSearch}>查詢</Button>
          </div>
          {noPlate ? (
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700 font-medium">
              一般購買，不記錄車牌
            </div>
          ) : customer ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">{customer.name}</span>
                </div>
                <span className="font-mono text-xs text-gray-400">{customer.licensePlate}</span>
              </div>
              <p className="text-gray-600">{customer.phone}</p>
              <p className="text-gray-500">{customer.vehicleModel ?? ''} {customer.vehicleColor ?? ''}</p>
            </div>
          ) : !noPlate && customers && customers.length > 1 && !manualCustomer ? (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">找到 {customers.length} 筆符合「{plateQuery}」，請選擇：</p>
              <div className="border rounded-lg overflow-hidden divide-y max-h-44 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2 text-sm"
                    onClick={() => setManualCustomer(c)}
                  >
                    <span className="font-medium truncate">{c.name}</span>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs text-gray-600">{c.licensePlate}</p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : notFound ? (
            <div className="space-y-2">
              <p className="text-xs text-amber-600 font-medium">找不到車牌 {plateQuery} 的車主記錄</p>
              {!showQuickAdd ? (
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" /> 新增車主
                </button>
              ) : (
                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-2">
                  <p className="text-xs font-semibold text-blue-700">新增車主 · {plateQuery}</p>
                  <Input
                    value={qf.name}
                    onChange={(e) => setQf((p) => ({ ...p, name: e.target.value }))}
                    placeholder="姓名 *"
                    className="h-8 text-xs"
                    autoFocus
                  />
                  <Input
                    value={qf.phone}
                    onChange={(e) => setQf((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="電話 *"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={qf.vehicleModel}
                    onChange={(e) => setQf((p) => ({ ...p, vehicleModel: e.target.value }))}
                    placeholder="車型（選填，例：RCS 125）"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={qf.vehicleColor}
                    onChange={(e) => setQf((p) => ({ ...p, vehicleColor: e.target.value }))}
                    placeholder="車色（選填，例：紅色）"
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-1.5 pt-0.5">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                      onClick={() => { setShowQuickAdd(false); setQf({ name: '', phone: '', vehicleModel: '', vehicleColor: '' }); }}>
                      取消
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-xs"
                      onClick={handleQuickAdd}
                      disabled={createCustomer.isPending}>
                      {createCustomer.isPending
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : '儲存新增'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold text-sm">費用明細</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">零件小計</span>
              <span>{formatCurrency(cart.subtotal())}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">工資</span>
              <input
                type="number"
                min={0}
                value={cart.laborFee}
                onChange={(e) => cart.setLaborFee(Number(e.target.value))}
                className="w-24 text-right border rounded px-2 py-0.5 text-sm"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">折扣</span>
              <input
                type="number"
                min={0}
                value={cart.discount}
                onChange={(e) => cart.setOrderDiscount(Number(e.target.value))}
                className="w-24 text-right border rounded px-2 py-0.5 text-sm text-red-500"
              />
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-base">
              <span>合計</span>
              <span className="text-primary-600">{formatCurrency(cart.total())}</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={createOrder.isPending || cart.items.length === 0 || (!noPlate && !customer)}
          >
            {createOrder.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 結帳中…</>
            ) : '確認結帳'}
          </Button>

          {!noPlate && !customer && (
            <p className="text-xs text-center text-gray-400">請先查詢車主後才能結帳</p>
          )}
        </div>
      </div>

      {/* ── Work order viewer (receipt + signature + PDF) ── */}
      <WorkOrderViewer
        orderId={completedOrderId}
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
      />

      {/* ── License plate scanner ─────────────────────────── */}
      {scannerOpen && (
        <PlateScanner
          onDetected={(plate) => {
            setPlateInput(plate);
            setPlateQuery(plate);
            setManualCustomer(null);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
