import { useState, useRef, useCallback } from 'react';
import { Search, Trash2, Plus, Minus, Printer, CheckCircle2, Loader2, ScanLine, FileDown } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { useProducts } from '../hooks/useProducts';
import { useCustomerByPlate } from '../hooks/useCustomers';
import { useCreateOrder, useOrderReceipt } from '../hooks/useOrders';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { PlateScanner } from '../components/PlateScanner';
import { WorkOrderDocument } from '../components/WorkOrderDocument';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkOrderPDF } from '../hooks/useWorkOrderPDF';
import { cn, formatCurrency, formatDate } from '../lib/utils';

export function CheckoutPage() {
  const { user } = useAuthStore();
  const cart = useCartStore();
  const { toast } = useToast();

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Customer
  const [plateInput, setPlateInput] = useState('');
  const [plateQuery, setPlateQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Service description
  const [description, setDescription] = useState('');

  // Receipt
  const [completedOrderId, setCompletedOrderId] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);

  // PDF
  const { settings } = useSettingsStore();
  const { generate, isGenerating } = useWorkOrderPDF();
  const pdfRef = useRef<HTMLDivElement>(null);

  const { data: searchResults, isFetching: searching } = useProducts(
    searchActive && searchQuery.length >= 1 ? { keyword: searchQuery, pageSize: 8 } : {},
  );

  const { data: customers } = useCustomerByPlate(plateQuery);
  const customer = customers?.[0];

  const createOrder = useCreateOrder();
  const { data: receipt } = useOrderReceipt(completedOrderId);

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
    setPlateQuery(plateInput.toUpperCase().replace(/\s/g, ''));
  };

  async function handleCheckout() {
    if (cart.items.length === 0) {
      toast('購物車是空的', 'error');
      return;
    }
    if (!customer) {
      toast('請先查詢車主', 'error');
      return;
    }

    try {
      const order = await createOrder.mutateAsync({
        customerId: customer.id,
        laborFee: cart.laborFee,
        discount: cart.discount,
        note: description || undefined,
        service: description
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
          <h3 className="font-semibold text-sm">車主查詢</h3>
          <div className="flex gap-2">
            <Input
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
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
          {customer ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-semibold">{customer.name}</span>
              </div>
              <p className="text-gray-600">{customer.phone}</p>
              <p className="text-gray-500">{customer.vehicleModel ?? ''} {customer.vehicleColor ?? ''}</p>
            </div>
          ) : plateQuery ? (
            <p className="text-xs text-gray-400">找不到車牌 {plateQuery} 的車主記錄</p>
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
            disabled={createOrder.isPending || cart.items.length === 0 || !customer}
          >
            {createOrder.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 結帳中…</>
            ) : '確認結帳'}
          </Button>

          {!customer && (
            <p className="text-xs text-center text-gray-400">請先查詢車主後才能結帳</p>
          )}
        </div>
      </div>

      {/* ── Receipt modal ─────────────────────────────────── */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" /> 結帳成功
            </DialogTitle>
          </DialogHeader>
          {receipt && (
            <div id="receipt-print" className="space-y-4">
              <div className="text-center border-b pb-3">
                <h3 className="font-bold text-lg">機車行 ERP</h3>
                <p className="text-sm text-gray-500">工單 {receipt.orderNo}</p>
                <p className="text-xs text-gray-400">{receipt.issuedAt}</p>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">車主</span>
                  <span>{receipt.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">電話</span>
                  <span>{receipt.customer.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">車牌</span>
                  <span className="font-mono">{receipt.customer.licensePlate}</span>
                </div>
              </div>
              {receipt.serviceDescription && (
                <div className="text-xs bg-gray-50 rounded p-2 text-gray-600">
                  維修說明：{receipt.serviceDescription}
                </div>
              )}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">品名</th>
                    <th className="text-center py-1">數量</th>
                    <th className="text-right py-1">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item, i) => (
                    <tr key={i} className="border-b border-dashed">
                      <td className="py-1 text-gray-700">{item.name}</td>
                      <td className="py-1 text-center">{item.qty} {item.unit}</td>
                      <td className="py-1 text-right">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-sm space-y-1 border-t pt-2">
                <div className="flex justify-between text-gray-500">
                  <span>工資</span><span>{formatCurrency(receipt.laborFee)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-red-500">
                    <span>折扣</span><span>-{formatCurrency(receipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>總計</span>
                  <span className="text-primary-600">{formatCurrency(receipt.total)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> 列印
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={isGenerating}
                  onClick={() => {
                    if (pdfRef.current) generate(pdfRef.current, `工單_${receipt!.orderNo}.pdf`);
                  }}
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> 產生中…</>
                  ) : (
                    <><FileDown className="h-4 w-4" /> 下載 PDF</>
                  )}
                </Button>
                <Button className="flex-1" onClick={() => setShowReceipt(false)}>
                  關閉
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden A4 template for PDF generation */}
      {receipt && (
        <div
          style={{ position: 'absolute', left: '-9999px', top: 0, overflow: 'hidden' }}
          aria-hidden
        >
          <WorkOrderDocument ref={pdfRef} order={receipt} settings={settings} />
        </div>
      )}

      {/* ── License plate scanner ─────────────────────────── */}
      {scannerOpen && (
        <PlateScanner
          onDetected={(plate) => {
            setPlateInput(plate);
            setPlateQuery(plate);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </div>
  );
}
