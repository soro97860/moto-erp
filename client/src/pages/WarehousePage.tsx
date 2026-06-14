import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, ScanLine, ArrowUpCircle, Loader2, CheckCircle2, MapPin, X,
} from 'lucide-react';
import { useLocations, useStockIn, useTodayMovements } from '../hooks/useWarehouse';
import { useProducts, type Product } from '../hooks/useProducts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useToast } from '../components/ui/toast';
import { formatCurrency, formatDate, cn } from '../lib/utils';

export function WarehousePage() {
  const { toast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [locationId, setLocationId] = useState('');
  const [reason, setReason] = useState('');

  const { data: searchResults, isFetching: searching } = useProducts(
    searchActive && searchQuery.length >= 1 ? { keyword: searchQuery, pageSize: 10 } : {},
  );
  const { data: locations = [] } = useLocations();
  const { data: todayMovements = [] } = useTodayMovements();
  const stockIn = useStockIn();

  useEffect(() => { searchRef.current?.focus(); }, []);

  // Auto-assign location when product changes
  useEffect(() => {
    if (!selectedProduct) { setLocationId(''); return; }

    const lockedToExisting =
      selectedProduct.storageLocation !== null && selectedProduct.stockQty > 0;

    if (lockedToExisting) {
      // Has stock in a known location → keep it, don't overwrite
      setLocationId(selectedProduct.storageLocation!.id);
    } else {
      // Stock zero OR no location assigned → auto-pick first empty location
      const firstEmpty = locations.find((l) => (l._count?.products ?? 0) === 0);
      setLocationId(firstEmpty?.id ?? selectedProduct.storageLocation?.id ?? '');
    }
  }, [selectedProduct, locations]);

  const handleSelectProduct = useCallback((p: Product) => {
    setSelectedProduct(p);
    setQty(1);
    setReason('');
    setSearchQuery('');
    setSearchActive(false);
  }, []);

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchResults?.items.length === 1) {
      handleSelectProduct(searchResults.items[0]);
    }
    if (e.key === 'Escape') { setSearchActive(false); setSearchQuery(''); }
  }

  async function handleStockIn() {
    if (!selectedProduct) return;
    if (qty <= 0) { toast('數量必須大於 0', 'error'); return; }

    try {
      await stockIn.mutateAsync({
        productId: selectedProduct.id,
        qty,
        storageLocationId: locationId || undefined,
        reason: reason || undefined,
      });
      toast(`入庫成功：${selectedProduct.name} × ${qty}`, 'success');
      setSelectedProduct(null);
      setQty(1);
      setLocationId('');
      setReason('');
      setTimeout(() => searchRef.current?.focus(), 100);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '入庫失敗', 'error');
    }
  }

  const todayInCount = todayMovements.filter((m) => m.type === 'IN').length;

  // Derive location display hint
  const lockedToExisting = !!(
    selectedProduct?.storageLocation && selectedProduct.stockQty > 0
  );
  const isAutoAssigned = !!locationId && !lockedToExisting;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">倉儲入庫</h2>
        <Badge variant="info">今日入庫 {todayInCount} 筆</Badge>
      </div>

      {/* ── Product search ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex items-center gap-2 text-gray-600">
          <Search className="h-4 w-4" />
          <span className="text-sm font-medium">搜尋商品</span>
          <span className="text-xs text-gray-400">（名稱、SKU 或條碼皆可）</span>
        </div>

        <div className="relative">
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchActive(e.target.value.length > 0);
              if (selectedProduct) setSelectedProduct(null);
            }}
            onFocus={() => setSearchActive(searchQuery.length > 0)}
            onKeyDown={handleSearchKey}
            placeholder="輸入名稱、SKU 或條碼…"
            className="h-12 text-base pr-9"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => { setSearchQuery(''); setSearchActive(false); setSelectedProduct(null); }}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Search dropdown */}
          {searchActive && (
            <div className="absolute top-full mt-1 left-0 right-0 z-20 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
              {searching && (
                <div className="p-3 text-sm text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> 搜尋中…
                </div>
              )}
              {!searching && (!searchResults || searchResults.items.length === 0) && (
                <p className="p-3 text-sm text-gray-400">找不到符合商品</p>
              )}
              {searchResults?.items.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between gap-3 border-b last:border-0"
                  onClick={() => handleSelectProduct(p)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {p.sku}{p.brand ? ` · ${p.brand.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className={cn(
                      'text-xs font-semibold',
                      p.stockQty === 0 ? 'text-red-500' : 'text-gray-600',
                    )}>
                      庫存 {p.stockQty} {p.unit}
                    </p>
                    {p.storageLocation && (
                      <p className="text-xs text-gray-400 flex items-center justify-end gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {p.storageLocation.floor}-{p.storageLocation.cabinet}-{p.storageLocation.shelf}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-1">
          <ScanLine className="h-3 w-3" />
          掃碼槍可直接掃描條碼，掃入後按 Enter 若只有一筆結果則自動選取
        </p>
      </div>

      {/* ── Stock-in form ───────────────────────────────────── */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          {/* Product info */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <h3 className="font-semibold">{selectedProduct.name}</h3>
              </div>
              <p className="text-xs text-gray-400 ml-7">SKU: {selectedProduct.sku}</p>
              {selectedProduct.brand && (
                <p className="text-xs text-gray-400 ml-7">廠牌: {selectedProduct.brand.name}</p>
              )}
              {selectedProduct.category && (
                <p className="text-xs text-gray-400 ml-7">分類: {selectedProduct.category.name}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium">成本 {formatCurrency(selectedProduct.costPrice)}</p>
              <p className="text-xs text-gray-400 mt-0.5">現有庫存</p>
              <p className={cn(
                'text-lg font-bold',
                selectedProduct.stockQty === 0 ? 'text-red-600' : 'text-gray-800',
              )}>
                {selectedProduct.stockQty} {selectedProduct.unit}
              </p>
            </div>
          </div>

          {/* Form fields */}
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
              <div className="flex items-center justify-between">
                <Label>儲位</Label>
                {lockedToExisting && (
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> 原有儲位
                  </span>
                )}
                {isAutoAssigned && (
                  <span className="text-xs text-blue-500 flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" /> 自動分配
                  </span>
                )}
              </div>
              <Select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-11"
              >
                <option value="">— 不指定 —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.floor}-{l.cabinet}-{l.shelf}
                    {l.note ? ` (${l.note})` : ''}
                    {' '}[{l._count?.products ?? 0} 樣]
                  </option>
                ))}
              </Select>
              {lockedToExisting && (
                <p className="text-xs text-gray-400">
                  有庫存時保留原儲位；歸零後可自動重新分配
                </p>
              )}
            </div>

            <div className="col-span-2 space-y-1">
              <Label>備註 / 來源</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="殺肉件、廠商貨號、批次來源…（選填）"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
            <span>入庫後庫存</span>
            <span className="font-bold text-green-600 text-base">
              {selectedProduct.stockQty} → {selectedProduct.stockQty + qty} {selectedProduct.unit}
            </span>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedProduct(null)}>
              取消
            </Button>
            <Button
              className="flex-1 h-12 text-base"
              onClick={handleStockIn}
              disabled={stockIn.isPending}
            >
              {stockIn.isPending ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> 入庫中…</>
              ) : (
                <><ArrowUpCircle className="h-5 w-5" /> 確認入庫 × {qty}</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Today's in-stock log ────────────────────────────── */}
      {todayMovements.filter((m) => m.type === 'IN').length > 0 && (
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
