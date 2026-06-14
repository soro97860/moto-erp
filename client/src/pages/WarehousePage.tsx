import { useState, useRef, useEffect } from 'react';
import { ScanLine, CheckCircle2, AlertTriangle, Loader2, ArrowUpCircle } from 'lucide-react';
import { useLocations, useStockIn, useTodayMovements } from '../hooks/useWarehouse';
import { useProductByBarcode } from '../hooks/useProducts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { formatCurrency, formatDate, cn } from '../lib/utils';

export function WarehousePage() {
  const { toast } = useToast();

  // Barcode scanner state
  const [barcode, setBarcode] = useState('');
  const [activeBarcode, setActiveBarcode] = useState('');
  const [qty, setQty] = useState(1);
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('');
  const [, setLastStocked] = useState<string | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  const { data: product, isLoading: productLoading, error: productError } = useProductByBarcode(activeBarcode);
  const { data: locations = [] } = useLocations();
  const { data: todayMovements = [] } = useTodayMovements();
  const stockIn = useStockIn();

  // Auto-focus barcode input on mount
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  // When product loads, prefill its storageLocation
  useEffect(() => {
    if (product?.storageLocation) {
      setLocationId(product.storageLocation.id);
    }
  }, [product]);

  function handleBarcodeKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = barcode.trim();
      if (val) {
        setActiveBarcode(val);
        setBarcode('');
        setQty(1);
        setReason('');
      }
    }
  }

  async function handleStockIn() {
    if (!product) return;
    if (qty <= 0) { toast('數量必須大於 0', 'error'); return; }

    try {
      await stockIn.mutateAsync({
        productId: product.id,
        qty,
        storageLocationId: locationId || undefined,
        reason: reason || undefined,
      });
      setLastStocked(product.name);
      toast(`入庫成功：${product.name} × ${qty}`, 'success');
      // Reset for next scan
      setActiveBarcode('');
      setBarcode('');
      setQty(1);
      setLocationId('');
      setReason('');
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '入庫失敗', 'error');
    }
  }

  const todayInCount = todayMovements.filter((m) => m.type === 'IN').length;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">倉儲入庫</h2>
        <Badge variant="info">今日入庫 {todayInCount} 筆</Badge>
      </div>

      {/* ── Barcode scanner input ─────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-600">
          <ScanLine className="h-5 w-5" />
          <span className="text-sm font-medium">掃描或輸入條碼</span>
        </div>

        <div className="flex gap-2">
          <Input
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleBarcodeKey}
            placeholder="條碼（按 Enter 查詢）"
            className="font-mono text-base h-12 text-center tracking-widest"
            autoComplete="off"
          />
          <Button
            onClick={() => {
              if (barcode.trim()) {
                setActiveBarcode(barcode.trim());
                setBarcode('');
              }
            }}
            className="h-12 px-5"
          >
            查詢
          </Button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          藍牙掃碼槍：掃描後自動送出，無需按 Enter
        </p>
      </div>

      {/* ── Product confirmation card ─────────────────────── */}
      {activeBarcode && (
        <div className={cn(
          'rounded-xl border p-5 space-y-4',
          product ? 'bg-white' : 'bg-red-50 border-red-200',
        )}>
          {productLoading && (
            <div className="flex items-center justify-center gap-2 text-gray-500 py-4">
              <Loader2 className="h-5 w-5 animate-spin" /> 查詢中…
            </div>
          )}

          {!productLoading && productError && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">找不到條碼「{activeBarcode}」對應的商品</span>
            </div>
          )}

          {!productLoading && product && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    <h3 className="font-semibold">{product.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 ml-7">SKU: {product.sku}</p>
                  {product.brand && (
                    <p className="text-xs text-gray-500 ml-7">廠牌: {product.brand.name}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">成本 {formatCurrency(product.costPrice)}</p>
                  <p className="text-xs text-gray-500">現有庫存</p>
                  <p className={cn(
                    'text-lg font-bold',
                    product.stockQty <= product.minStockQty ? 'text-red-600' : 'text-gray-800',
                  )}>
                    {product.stockQty} {product.unit}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>入庫數量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="text-center text-lg h-11 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label>儲位</Label>
                  <Select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="h-11"
                  >
                    <option value="">— 維持現有 —</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.floor}-{l.cabinet}-{l.shelf}
                        {l.note ? ` (${l.note})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>備註</Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="入庫來源或備註（選填）"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                <span>入庫後庫存預覽</span>
                <span className="font-bold text-green-600 text-base">
                  {product.stockQty} → {product.stockQty + qty} {product.unit}
                </span>
              </div>

              <Button
                className="w-full h-12 text-base"
                onClick={handleStockIn}
                disabled={stockIn.isPending}
              >
                {stockIn.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> 入庫中…</>
                ) : (
                  <><ArrowUpCircle className="h-5 w-5" /> 確認入庫 × {qty}</>
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Today's movements ─────────────────────────────── */}
      {todayMovements.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-600">今日入庫紀錄</h3>
          <div className="bg-white rounded-xl border divide-y">
            {todayMovements
              .filter((m) => m.type === 'IN')
              .map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.product.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(m.createdAt, 'HH:mm')} · {m.operator.name}
                      {m.reason && ` · ${m.reason}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-green-600 font-bold">+{m.qty} {m.product.unit}</span>
                    <p className="text-xs text-gray-400">{m.qtyBefore} → {m.qtyAfter}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
