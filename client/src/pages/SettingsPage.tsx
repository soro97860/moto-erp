import { useState, useEffect } from 'react';
import {
  Loader2, Plus, Trash2, Pencil, Check, X, UserPlus, RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { cn } from '../lib/utils';
import {
  useShopSettings, useUpdateShopSettings,
  useUsers, useCreateUser, useUpdateUser, useToggleUserActive,
  useBrands, useCreateBrand, useDeleteBrand,
  useCategories, useCreateCategory, useDeleteCategory,
  useStorageLocations, useCreateStorageLocation,
  useBatchCreateStorageLocations, useDeleteStorageLocation,
} from '../hooks/useSettings';

// ── Tab types ────────────────────────────────────────────────────────────────
type Tab = 'shop' | 'staff' | 'brands' | 'categories' | 'locations' | 'system';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'shop',       label: '店家資訊' },
  { id: 'staff',      label: '員工管理' },
  { id: 'brands',     label: '廠牌管理' },
  { id: 'categories', label: '分類管理' },
  { id: 'locations',  label: '儲位管理' },
  { id: 'system',     label: '系統設定' },
];
const ROLE_LABELS: Record<string, string> = {
  ADMIN: '老闆/管理員', MECHANIC: '技師', CASHIER: '收銀員',
};
const ROLE_VARIANTS: Record<string, 'success' | 'info' | 'warning'> = {
  ADMIN: 'success', MECHANIC: 'info', CASHIER: 'warning',
};

// ── Helper ───────────────────────────────────────────────────────────────────
function SectionLoader() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: 店家資訊
// ─────────────────────────────────────────────────────────────────────────────
function ShopInfoTab() {
  const { toast } = useToast();
  const syncFromDB = useSettingsStore((s) => s.syncFromDB);
  const { data, isLoading } = useShopSettings();
  const update = useUpdateShopSettings();

  const [form, setForm] = useState({
    shopName: '', shopAddress: '', shopPhone: '', shopTaxId: '',
    shopWarranty: '', shopThankYou: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        shopName:     data.shopName     ?? '',
        shopAddress:  data.shopAddress  ?? '',
        shopPhone:    data.shopPhone    ?? '',
        shopTaxId:    data.shopTaxId    ?? '',
        shopWarranty: data.shopWarranty ?? '',
        shopThankYou: data.shopThankYou ?? '',
      });
    }
  }, [data]);

  async function handleSave() {
    try {
      await update.mutateAsync(form);
      syncFromDB(form);
      toast('店家資訊已儲存', 'success');
    } catch {
      toast('儲存失敗', 'error');
    }
  }

  if (isLoading) return <SectionLoader />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">店家基本資料</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        {([
          ['shopName',     '店家名稱 *',   '機車行'],
          ['shopAddress',  '地址',         '台北市...'],
          ['shopPhone',    '電話',         '(02) 1234-5678'],
          ['shopTaxId',    '統一編號',     '12345678（選填）'],
        ] as [keyof typeof form, string, string][]).map(([k, label, ph]) => (
          <div key={k} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <Input
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              placeholder={ph}
            />
          </div>
        ))}
        {([
          ['shopThankYou', '感謝語'],
          ['shopWarranty', '保固說明'],
        ] as [keyof typeof form, string][]).map(([k, label]) => (
          <div key={k} className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <textarea
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        ))}
        <Button onClick={handleSave} disabled={update.isPending} className="mt-2">
          {update.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> 儲存中…</> : '儲存設定'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: 員工管理
// ─────────────────────────────────────────────────────────────────────────────
function StaffTab() {
  const { toast } = useToast();
  const { user: self } = useAuthStore();
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const toggleUser = useToggleUserActive();

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', name: '', role: 'MECHANIC', phone: '' });
  const [editForm, setEditForm] = useState({ name: '', phone: '', role: 'MECHANIC', password: '' });

  async function handleAdd() {
    if (!addForm.username || !addForm.password || !addForm.name) {
      toast('帳號、密碼、姓名為必填', 'error'); return;
    }
    try {
      await createUser.mutateAsync(addForm);
      toast(`已新增 ${addForm.name}`, 'success');
      setAddOpen(false);
      setAddForm({ username: '', password: '', name: '', role: 'MECHANIC', phone: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '新增失敗', 'error');
    }
  }

  function openEdit(u: NonNullable<typeof users>[0]) {
    setEditId(u.id);
    setEditForm({ name: u.name, phone: u.phone ?? '', role: u.role, password: '' });
  }

  async function handleEdit() {
    if (!editId) return;
    const payload: Record<string, unknown> = {
      name: editForm.name,
      phone: editForm.phone || null,
      role: editForm.role,
    };
    if (editForm.password) payload.password = editForm.password;
    try {
      await updateUser.mutateAsync({ id: editId, ...payload });
      toast('已更新', 'success');
      setEditId(null);
    } catch {
      toast('更新失敗', 'error');
    }
  }

  if (isLoading) return <SectionLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">共 {users?.length ?? 0} 位員工</span>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1">
          <UserPlus className="h-4 w-4" /> 新增員工
        </Button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['姓名', '帳號', '角色', '電話', '狀態', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.map((u) => (
              <tr key={u.id} className={cn('transition-colors', !u.isActive && 'opacity-50 bg-gray-50')}>
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.username}</td>
                <td className="px-4 py-3">
                  <Badge variant={ROLE_VARIANTS[u.role] ?? 'outline'}>{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.isActive ? 'success' : 'destructive'}>{u.isActive ? '啟用' : '停用'}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(u)} title="編輯">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {u.id !== self?.id && (
                      <Button
                        variant="ghost" size="sm"
                        className={cn('h-7 px-2 text-xs', u.isActive ? 'text-red-500 hover:text-red-600' : 'text-green-600 hover:text-green-700')}
                        onClick={() => toggleUser.mutate(u.id)}
                        disabled={toggleUser.isPending}
                      >
                        {u.isActive ? '停用' : '啟用'}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>新增員工帳號</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {([['username', '帳號 *', 'text'], ['password', '密碼 *', showPw ? 'text' : 'password'], ['name', '姓名 *', 'text'], ['phone', '電話', 'text']] as [keyof typeof addForm, string, string][]).map(([k, label, type]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <div className="relative">
                  <Input
                    type={type}
                    value={addForm[k]}
                    onChange={(e) => setAddForm((f) => ({ ...f, [k]: e.target.value }))}
                  />
                  {k === 'password' && (
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">角色</label>
              <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd} disabled={createUser.isPending}>
              {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '新增'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={editId !== null} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>編輯員工資料</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {([['name', '姓名'], ['phone', '電話']] as [keyof typeof editForm, string][]).map(([k, label]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <Input value={editForm[k]} onChange={(e) => setEditForm((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">角色</label>
              <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full border rounded-md px-3 h-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">新密碼（留空不更改）</label>
              <Input type="password" value={editForm.password}
                onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="至少 6 個字元" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditId(null)}>取消</Button>
            <Button onClick={handleEdit} disabled={updateUser.isPending}>儲存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable tag-style list with inline add
// ─────────────────────────────────────────────────────────────────────────────
function TagList({
  items,
  onAdd,
  onDelete,
  isAdding,
  isDeleting,
}: {
  items: Array<{ id: string; name: string }>;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isAdding: boolean;
  isDeleting: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  async function handleAdd() {
    if (!name.trim()) return;
    await onAdd(name.trim());
    setName('');
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
            {item.name}
            <button onClick={() => onDelete(item.id)} disabled={isDeleting}
              className="ml-1 text-gray-400 hover:text-red-500 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="名稱"
              className="h-7 w-36 text-sm"
              autoFocus
            />
            <button onClick={handleAdd} disabled={isAdding} className="text-green-600 hover:text-green-700">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-3 py-1 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
            <Plus className="h-3 w-3" /> 新增
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: 廠牌管理
// ─────────────────────────────────────────────────────────────────────────────
function BrandsTab() {
  const { toast } = useToast();
  const { data: brands, isLoading } = useBrands();
  const create = useCreateBrand();
  const remove = useDeleteBrand();

  if (isLoading) return <SectionLoader />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">廠牌管理</CardTitle></CardHeader>
      <CardContent>
        <TagList
          items={brands ?? []}
          isAdding={create.isPending}
          isDeleting={remove.isPending}
          onAdd={async (name) => {
            try { await create.mutateAsync({ name }); toast(`已新增 ${name}`, 'success'); }
            catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
              toast(msg ?? '新增失敗', 'error');
            }
          }}
          onDelete={async (id) => {
            try { await remove.mutateAsync(id); toast('已刪除', 'success'); }
            catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
              toast(msg ?? '刪除失敗', 'error');
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4: 分類管理
// ─────────────────────────────────────────────────────────────────────────────
function CategoriesTab() {
  const { toast } = useToast();
  const { data: categories, isLoading } = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();

  if (isLoading) return <SectionLoader />;

  const flat = (categories ?? []).flatMap((c) => [c, ...(c.children ?? [])]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">零件分類管理</CardTitle></CardHeader>
      <CardContent>
        <TagList
          items={flat}
          isAdding={create.isPending}
          isDeleting={remove.isPending}
          onAdd={async (name) => {
            try { await create.mutateAsync({ name }); toast(`已新增 ${name}`, 'success'); }
            catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
              toast(msg ?? '新增失敗（可能名稱重複）', 'error');
            }
          }}
          onDelete={async (id) => {
            try { await remove.mutateAsync(id); toast('已刪除', 'success'); }
            catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
              toast(msg ?? '刪除失敗', 'error');
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 5: 儲位管理
// ─────────────────────────────────────────────────────────────────────────────
function LocationsTab() {
  const { toast } = useToast();
  const { data: locs, isLoading } = useStorageLocations();
  const create = useCreateStorageLocation();
  const batchCreate = useBatchCreateStorageLocations();
  const remove = useDeleteStorageLocation();

  // Single add
  const [single, setSingle] = useState({ floor: '', cabinet: '', shelf: '' });
  // Batch add
  const [batch, setBatch] = useState({ floor: '1F', cabFrom: 'A', cabTo: 'C', shelfFrom: '1', shelfTo: '3' });
  const [batchPreview, setBatchPreview] = useState<Array<{ floor: string; cabinet: string; shelf: string }>>([]);
  const [showBatch, setShowBatch] = useState(false);

  function generateBatchPreview() {
    const items: Array<{ floor: string; cabinet: string; shelf: string }> = [];
    const cabStart = batch.cabFrom.toUpperCase().charCodeAt(0);
    const cabEnd   = batch.cabTo.toUpperCase().charCodeAt(0);
    const sStart   = parseInt(batch.shelfFrom, 10);
    const sEnd     = parseInt(batch.shelfTo, 10);
    if (isNaN(sStart) || isNaN(sEnd) || cabEnd < cabStart || sEnd < sStart) return;
    for (let c = cabStart; c <= cabEnd; c++) {
      for (let s = sStart; s <= sEnd; s++) {
        items.push({ floor: batch.floor, cabinet: `${String.fromCharCode(c)}櫃`, shelf: `第${s}層` });
      }
    }
    setBatchPreview(items);
  }

  async function handleBatchCreate() {
    if (!batchPreview.length) return;
    try {
      const result = await batchCreate.mutateAsync(batchPreview);
      toast(`已新增 ${result.count} 個儲位（重複自動跳過）`, 'success');
      setBatchPreview([]);
      setShowBatch(false);
    } catch { toast('批次新增失敗', 'error'); }
  }

  if (isLoading) return <SectionLoader />;

  return (
    <div className="space-y-4">
      {/* Single add */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">單一新增儲位</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap items-end">
            {([['floor', '樓層', '1F'], ['cabinet', '櫃位', 'A櫃'], ['shelf', '層次', '第1層']] as [keyof typeof single, string, string][]).map(([k, label, ph]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{label}</label>
                <Input value={single[k]} onChange={(e) => setSingle((s) => ({ ...s, [k]: e.target.value }))}
                  placeholder={ph} className="w-28" />
              </div>
            ))}
            <Button size="sm" onClick={async () => {
              if (!single.floor || !single.cabinet || !single.shelf) { toast('請填寫所有欄位', 'error'); return; }
              try { await create.mutateAsync(single); toast('已新增儲位', 'success'); setSingle({ floor: '', cabinet: '', shelf: '' }); }
              catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast(msg ?? '新增失敗（可能重複）', 'error');
              }
            }} disabled={create.isPending} className="gap-1 mb-0.5">
              <Plus className="h-4 w-4" /> 新增
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch add */}
      <Card>
        <CardHeader>
          <button className="flex w-full items-center justify-between" onClick={() => setShowBatch((v) => !v)}>
            <CardTitle className="text-base">批次新增儲位</CardTitle>
            <span className="text-xs text-gray-400">{showBatch ? '收起' : '展開'}</span>
          </button>
        </CardHeader>
        {showBatch && (
          <CardContent className="space-y-3">
            <div className="flex gap-3 flex-wrap items-end text-sm">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">樓層</label>
                <Input value={batch.floor} onChange={(e) => setBatch((b) => ({ ...b, floor: e.target.value }))} className="w-20" placeholder="1F" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">櫃位 A → Z</label>
                <div className="flex items-center gap-1">
                  <Input value={batch.cabFrom} onChange={(e) => setBatch((b) => ({ ...b, cabFrom: e.target.value }))} className="w-14 text-center uppercase" maxLength={1} />
                  <span className="text-gray-400">→</span>
                  <Input value={batch.cabTo} onChange={(e) => setBatch((b) => ({ ...b, cabTo: e.target.value }))} className="w-14 text-center uppercase" maxLength={1} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">層次 1 → N</label>
                <div className="flex items-center gap-1">
                  <Input value={batch.shelfFrom} onChange={(e) => setBatch((b) => ({ ...b, shelfFrom: e.target.value }))} className="w-14 text-center" />
                  <span className="text-gray-400">→</span>
                  <Input value={batch.shelfTo} onChange={(e) => setBatch((b) => ({ ...b, shelfTo: e.target.value }))} className="w-14 text-center" />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={generateBatchPreview} className="gap-1 mb-0.5">
                <RefreshCw className="h-3.5 w-3.5" /> 預覽
              </Button>
            </div>
            {batchPreview.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">預覽 {batchPreview.length} 個儲位：</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {batchPreview.map((l, i) => (
                    <span key={i} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5">
                      {l.floor}-{l.cabinet}-{l.shelf}
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={handleBatchCreate} disabled={batchCreate.isPending}>
                  {batchCreate.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> 新增中…</> : `確認新增 ${batchPreview.length} 個`}
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Locations table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['樓層', '櫃位', '層次', '商品數', '操作'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {locs?.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">{loc.floor}</td>
                  <td className="px-4 py-2.5">{loc.cabinet}</td>
                  <td className="px-4 py-2.5">{loc.shelf}</td>
                  <td className="px-4 py-2.5 text-gray-500">{loc._count?.products ?? 0}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                      onClick={async () => {
                        try { await remove.mutateAsync(loc.id); toast('已刪除', 'success'); }
                        catch (err: unknown) {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                          toast(msg ?? '刪除失敗', 'error');
                        }
                      }}
                      disabled={remove.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-400 border-t">共 {locs?.length ?? 0} 個儲位</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 6: 系統設定
// ─────────────────────────────────────────────────────────────────────────────
function SystemTab() {
  const { toast } = useToast();
  const { data, isLoading } = useShopSettings();
  const update = useUpdateShopSettings();
  const [threshold, setThreshold] = useState('5');

  useEffect(() => {
    if (data?.lowStockThreshold) setThreshold(data.lowStockThreshold);
  }, [data]);

  if (isLoading) return <SectionLoader />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">系統設定</CardTitle></CardHeader>
      <CardContent className="space-y-6 max-w-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">庫存警示閾值（件）</label>
          <p className="text-xs text-gray-500">當商品庫存量 ≤ 此值時，顯示低庫存警示。</p>
          <div className="flex gap-2 items-center">
            <Input
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-24"
            />
            <Button
              size="sm"
              onClick={async () => {
                const v = parseInt(threshold, 10);
                if (isNaN(v) || v < 0) { toast('請輸入有效數字', 'error'); return; }
                try {
                  await update.mutateAsync({ lowStockThreshold: String(v) });
                  toast('已儲存', 'success');
                } catch { toast('儲存失敗', 'error'); }
              }}
              disabled={update.isPending}
            >
              儲存
            </Button>
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
          <p className="font-semibold mb-1">⚠ 初始帳號提醒</p>
          <p>預設管理員帳號 <code className="bg-amber-100 px-1 rounded">admin / admin1234</code>，請登入後至員工管理頁面立即修改密碼。</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('shop');

  if (user?.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">僅管理員可存取此頁面</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">系統設定</h2>

      {/* Tab navigation */}
      <div className="flex gap-0.5 border-b overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === 'shop'       && <ShopInfoTab />}
        {activeTab === 'staff'      && <StaffTab />}
        {activeTab === 'brands'     && <BrandsTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'locations'  && <LocationsTab />}
        {activeTab === 'system'     && <SystemTab />}
      </div>
    </div>
  );
}
