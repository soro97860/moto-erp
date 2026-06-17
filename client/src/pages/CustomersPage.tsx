import { useState } from 'react';
import {
  Search, ChevronDown, ChevronUp, User, Phone, Car,
  Clock, Wrench, Package, Plus, Loader2, AlertCircle, Pencil, Cog,
} from 'lucide-react';
import {
  useCustomers, useCustomerHistory, useCreateCustomer, useUpdateCustomer,
  type Customer, type ServiceRecord,
} from '../hooks/useCustomers';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { formatCurrency, formatDate, cn } from '../lib/utils';

// ── Customer history timeline ─────────────────────────────────
function HistoryTimeline({ customerId }: { customerId: string }) {
  const { data: records = [], isLoading } = useCustomerHistory(customerId);

  if (isLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  if (records.length === 0) {
    return <p className="py-4 text-sm text-gray-400 text-center">尚無維修紀錄</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {records.map((record, idx) => (
        <div key={record.id} className="relative pl-6">
          {idx < records.length - 1 && (
            <div className="absolute left-2 top-5 bottom-0 w-px bg-gray-200" />
          )}
          <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary-100 border-2 border-primary-400 flex items-center justify-center">
            <Wrench className="h-2 w-2 text-primary-600" />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-gray-400">
                  {formatDate(record.serviceDate, 'YYYY-MM-DD')}
                  {record.mileage ? ` · ${record.mileage.toLocaleString()} km` : ''}
                </p>
                <p className="text-sm font-medium mt-0.5">{record.description}</p>
                {record.diagnosis && (
                  <p className="text-xs text-gray-500 mt-0.5">診斷：{record.diagnosis}</p>
                )}
              </div>
              {record.technician && (
                <Badge variant="secondary" className="shrink-0 text-xs">{record.technician.name}</Badge>
              )}
            </div>

            {record.orders.flatMap((o) => o.items).length > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
                  <Package className="h-3 w-3" /> 使用零件
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {record.orders.flatMap((o) => o.items).map((item, i) => (
                    <span key={i} className="text-xs bg-white border rounded px-2 py-0.5">
                      {item.product.name} × {item.qty} {item.product.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {record.orders.length > 0 && (
              <div className="border-t pt-2 flex items-center justify-between text-xs">
                <span className="text-gray-400">工單 {record.orders.map((o) => o.orderNo).join(', ')}</span>
                <span className="font-semibold">
                  {formatCurrency(record.orders.reduce((s, o) => s + Number(o.total), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-700 space-y-0.5">
          <p className="font-semibold">防爭議說明</p>
          <p>以上維修紀錄包含更換零件詳情及費用，均已由車主確認。如有疑問請聯繫本店。</p>
          <p className="text-amber-400 italic">可截圖此頁面作為存證使用。</p>
        </div>
      </div>
    </div>
  );
}

// ── Customer card ─────────────────────────────────────────────
function CustomerCard({ customer, onEdit }: { customer: Customer; onEdit: (c: Customer) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn('bg-white rounded-xl border overflow-hidden transition-shadow', expanded && 'shadow-md')}>
      <div className="flex items-stretch">
        <button
          className="flex-1 text-left p-4"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-semibold">{customer.name}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {customer.phone}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Car className="h-3 w-3" /> {customer.licensePlate}
                  </span>
                  {customer.vehicleModel && (
                    <span className="text-gray-400">{customer.vehicleModel}</span>
                  )}
                  {customer.engineNumber && (
                    <span className="flex items-center gap-1 text-gray-400 font-mono text-xs">
                      <Cog className="h-3 w-3" /> {customer.engineNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-400 hidden sm:block">
                {formatDate(customer.createdAt, 'YYYY-MM-DD')}
              </span>
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>
        </button>

        {/* Edit button on the right */}
        <button
          className="px-3 border-l text-gray-400 hover:text-primary-600 hover:bg-gray-50 transition-colors"
          title="編輯車主資料"
          onClick={(e) => { e.stopPropagation(); onEdit(customer); }}
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {/* Extra vehicle details */}
          {(customer.vehicleColor || customer.engineNumber || customer.note) && (
            <div className="pt-3 pb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {customer.vehicleColor && <span>車色：{customer.vehicleColor}</span>}
              {customer.engineNumber && <span className="font-mono">引擎號碼：{customer.engineNumber}</span>}
              {customer.note && <span>備註：{customer.note}</span>}
            </div>
          )}
          <HistoryTimeline customerId={customer.id} />
        </div>
      )}
    </div>
  );
}

// ── Shared customer form fields ───────────────────────────────
type FormState = {
  name: string; phone: string; licensePlate: string;
  engineNumber: string; vehicleModel: string; vehicleColor: string; note: string;
};

const emptyForm: FormState = {
  name: '', phone: '', licensePlate: '',
  engineNumber: '', vehicleModel: '', vehicleColor: '', note: '',
};

function CustomerFormFields({
  form, onChange,
}: {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="space-y-1">
        <Label>姓名 *</Label>
        <Input value={form.name} onChange={onChange('name')} placeholder="王小明" />
      </div>
      <div className="space-y-1">
        <Label>電話 *</Label>
        <Input value={form.phone} onChange={onChange('phone')} placeholder="0912-345-678" />
      </div>
      <div className="space-y-1">
        <Label>車牌號碼 *</Label>
        <Input
          value={form.licensePlate}
          onChange={onChange('licensePlate')}
          placeholder="ABC-1234"
          className="font-mono uppercase"
        />
      </div>
      <div className="space-y-1">
        <Label>引擎號碼</Label>
        <Input
          value={form.engineNumber}
          onChange={onChange('engineNumber')}
          placeholder="引擎序號"
          className="font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label>車型</Label>
        <Input value={form.vehicleModel} onChange={onChange('vehicleModel')} placeholder="YAMAHA BWS 125" />
      </div>
      <div className="space-y-1">
        <Label>車色</Label>
        <Input value={form.vehicleColor} onChange={onChange('vehicleColor')} placeholder="白色" />
      </div>
      <div className="col-span-2 space-y-1">
        <Label>備註</Label>
        <textarea
          value={form.note}
          onChange={onChange('note')}
          rows={2}
          placeholder="車況說明或特別注意事項…"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export function CustomersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  // Add
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(emptyForm);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const { data: customers = [], isLoading } = useCustomers(search);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  function addField(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setAddForm((prev) => ({ ...prev, [key]: e.target.value }));
  }
  function editField(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      phone: c.phone,
      licensePlate: c.licensePlate,
      engineNumber: c.engineNumber ?? '',
      vehicleModel: c.vehicleModel ?? '',
      vehicleColor: c.vehicleColor ?? '',
      note: c.note ?? '',
    });
    setEditOpen(true);
  }

  function formToPayload(f: FormState) {
    return {
      name: f.name,
      phone: f.phone,
      licensePlate: f.licensePlate.toUpperCase(),
      engineNumber: f.engineNumber || undefined,
      vehicleModel: f.vehicleModel || undefined,
      vehicleColor: f.vehicleColor || undefined,
      note: f.note || undefined,
    };
  }

  async function handleCreate() {
    if (!addForm.name || !addForm.phone || !addForm.licensePlate) {
      toast('請填寫必填欄位', 'error'); return;
    }
    try {
      await createCustomer.mutateAsync(formToPayload(addForm));
      toast('車主已新增', 'success');
      setAddOpen(false);
      setAddForm(emptyForm);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '新增失敗', 'error');
    }
  }

  async function handleUpdate() {
    if (!editForm.name || !editForm.phone || !editForm.licensePlate) {
      toast('請填寫必填欄位', 'error'); return;
    }
    try {
      await updateCustomer.mutateAsync({ id: editingId, ...formToPayload(editForm) });
      toast('資料已更新', 'success');
      setEditOpen(false);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(msg ?? '更新失敗', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">客戶資料</h2>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> 新增車主
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="輸入車牌、姓名或電話搜尋…"
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {isLoading && (
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}
        {!isLoading && customers.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? `找不到符合「${search}」的車主` : '尚無車主資料'}</p>
          </div>
        )}
        {customers.map((c) => (
          <CustomerCard key={c.id} customer={c} onEdit={openEdit} />
        ))}
      </div>

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增車主</DialogTitle>
          </DialogHeader>
          <CustomerFormFields form={addForm} onChange={addField} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={createCustomer.isPending}>
              {createCustomer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>編輯車主資料</DialogTitle>
          </DialogHeader>
          <CustomerFormFields form={editForm} onChange={editField} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
