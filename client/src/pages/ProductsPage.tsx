import { useState, useRef } from 'react';
import { Plus, Upload, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  useProducts, useBrands, useCategories,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useImportProducts,
} from '../hooks/useProducts';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

import { Select } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { cn, formatCurrency } from '../lib/utils';
import { useLocations } from '../hooks/useWarehouse';

interface ProductForm {
  sku: string; name: string; barcode: string;
  brandId: string; categoryId: string; storageLocationId: string;
  sellPrice: string; costPrice: string;
  stockQty: string; minStockQty: string; unit: string; note: string;
}

const emptyForm: ProductForm = {
  sku: '', name: '', barcode: '', brandId: '', categoryId: '',
  storageLocationId: '', sellPrice: '', costPrice: '',
  stockQty: '0', minStockQty: '0', unit: '個', note: '',
};

export function ProductsPage() {
  const { toast } = useToast();

  // Filters
  const [keyword, setKeyword] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  // Data
  const { data, isLoading } = useProducts({ keyword, brand: brandFilter, category: categoryFilter, page });
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();

  // Mutations
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const importProducts = useImportProducts();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: NonNullable<typeof data>['items'][0]) {
    setEditingId(p.id);
    setForm({
      sku: p.sku, name: p.name, barcode: p.barcode ?? '',
      brandId: p.brand?.id ?? '', categoryId: p.category?.id ?? '',
      storageLocationId: p.storageLocation?.id ?? '',
      sellPrice: p.sellPrice, costPrice: p.costPrice,
      stockQty: String(p.stockQty), minStockQty: String(p.minStockQty),
      unit: p.unit, note: '',
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    const payload = {
      sku: form.sku,
      name: form.name,
      barcode: form.barcode || null,
      brandId: form.brandId || null,
      categoryId: form.categoryId || null,
      storageLocationId: form.storageLocationId || null,
      sellPrice: Number(form.sellPrice),
      costPrice: Number(form.costPrice),
      stockQty: Number(form.stockQty),
      minStockQty: Number(form.minStockQty),
      unit: form.unit,
      note: form.note || undefined,
    };
    try {
      if (editingId) {
        await updateProduct.mutateAsync({ id: editingId, ...payload });
        toast('商品已更新', 'success');
      } else {
        await createProduct.mutateAsync(payload);
        toast('商品已新增', 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '操作失敗', 'error');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`確定要刪除「${name}」？`)) return;
    try {
      await deleteProduct.mutateAsync(id);
      toast('商品已刪除', 'success');
    } catch {
      toast('刪除失敗', 'error');
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      setImportJson(text);
    } else {
      // Convert CSV text to JSON preview
      setImportJson(text);
    }
  }

  async function handleImport() {
    try {
      let items: unknown[];
      try {
        items = JSON.parse(importJson);
        if (!Array.isArray(items)) throw new Error();
      } catch {
        toast('格式錯誤：請上傳 JSON 陣列格式', 'error');
        return;
      }
      const result = await importProducts.mutateAsync(items);
      toast(`匯入完成：新增 ${result.created}，更新 ${result.updated}`, 'success');
      setImportOpen(false);
      setImportJson('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '匯入失敗', 'error');
    }
  }

  const f = (key: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">商品管理</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> 批次匯入
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新增商品
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜尋品名、SKU、條碼…"
          className="w-full sm:w-56"
        />
        <Select value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }} className="w-40">
          <option value="">所有廠牌</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="w-40">
          <option value="">所有分類</option>
          {categories.map((c) => (
            <>
              <option key={c.id} value={c.id}>{c.name}</option>
              {c.children?.map((ch) => <option key={ch.id} value={ch.id}>　{ch.name}</option>)}
            </>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['SKU', '品名', '廠牌', '分類', '售價', '成本', '庫存', '儲位', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={9} className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
              )}
              {data?.items.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.brand?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category?.name ?? '—'}</td>
                  <td className="px-4 py-3">{formatCurrency(p.sellPrice)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatCurrency(p.costPrice)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-semibold', p.stockQty <= p.minStockQty ? 'text-red-600' : 'text-green-600')}>
                      {p.stockQty <= p.minStockQty && <AlertTriangle className="h-3 w-3 inline mr-1 mb-0.5" />}
                      {p.stockQty} {p.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.storageLocation
                      ? `${p.storageLocation.floor}-${p.storageLocation.cabinet}-${p.storageLocation.shelf}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(p.id, p.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* ── Product create/edit modal ──────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? '編輯商品' : '新增商品'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 space-y-1">
              <Label>品名 *</Label>
              <Input value={form.name} onChange={f('name')} placeholder="商品名稱" />
            </div>
            <div className="space-y-1">
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={f('sku')} placeholder="ENG-OIL-10W40" />
            </div>
            <div className="space-y-1">
              <Label>條碼</Label>
              <Input value={form.barcode} onChange={f('barcode')} placeholder="4712345…" />
            </div>
            <div className="space-y-1">
              <Label>廠牌</Label>
              <Select value={form.brandId} onChange={f('brandId')}>
                <option value="">— 無 —</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>分類</Label>
              <Select value={form.categoryId} onChange={f('categoryId')}>
                <option value="">— 無 —</option>
                {categories.map((c) => (
                  <>
                    <option key={c.id} value={c.id}>{c.name}</option>
                    {c.children?.map((ch) => <option key={ch.id} value={ch.id}>　{ch.name}</option>)}
                  </>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>售價 *</Label>
              <Input type="number" min={0} value={form.sellPrice} onChange={f('sellPrice')} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>成本</Label>
              <Input type="number" min={0} value={form.costPrice} onChange={f('costPrice')} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>初始庫存</Label>
              <Input type="number" min={0} value={form.stockQty} onChange={f('stockQty')} />
            </div>
            <div className="space-y-1">
              <Label>最低庫存</Label>
              <Input type="number" min={0} value={form.minStockQty} onChange={f('minStockQty')} />
            </div>
            <div className="space-y-1">
              <Label>單位</Label>
              <Input value={form.unit} onChange={f('unit')} placeholder="個 / 瓶 / 條" />
            </div>
            <div className="space-y-1">
              <Label>儲位</Label>
              <Select value={form.storageLocationId} onChange={f('storageLocationId')}>
                <option value="">— 無 —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.floor}-{l.cabinet}-{l.shelf}
                    {l.note ? ` (${l.note})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Batch import modal ─────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>批次匯入商品</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-700">
              <p className="font-medium mb-1">JSON 格式說明（每筆欄位）：</p>
              <p className="font-mono text-xs leading-relaxed">
                sku, name, barcode?, brandName?, categoryName?,<br />
                sellPrice, costPrice, stockQty?, minStockQty?, unit?
              </p>
            </div>
            <div>
              <label className="block mb-1 font-medium">上傳 JSON 檔案</label>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> 選擇檔案
              </Button>
            </div>
            <div>
              <label className="block mb-1 font-medium">或直接貼上 JSON</label>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={6}
                placeholder={'[\n  {"sku":"A001","name":"機油","sellPrice":180,"costPrice":100}\n]'}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
            <Button onClick={handleImport} disabled={!importJson.trim() || importProducts.isPending}>
              {importProducts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '開始匯入'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
