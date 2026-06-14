import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useSettingsStore, type ShopSettings } from '../stores/settingsStore';
import { useToast } from './ui/toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FIELDS: Array<{ key: keyof ShopSettings; label: string; placeholder?: string; multiline?: boolean }> = [
  { key: 'name',     label: '店家名稱',   placeholder: '機車行' },
  { key: 'address',  label: '地址',       placeholder: '台北市...' },
  { key: 'phone',    label: '電話',       placeholder: '(02) 1234-5678' },
  { key: 'taxId',    label: '統一編號',   placeholder: '12345678（選填）' },
  { key: 'thankYou', label: '感謝語',     placeholder: '感謝您的光臨，歡迎再次惠顧！', multiline: true },
  { key: 'warranty', label: '保固說明',   placeholder: '維修項目自完工日起保固 30 天…', multiline: true },
];

export function ShopSettingsModal({ open, onClose }: Props) {
  const { settings, updateSettings } = useSettingsStore();
  const { toast } = useToast();
  const [form, setForm] = useState<ShopSettings>(settings);

  useEffect(() => {
    if (open) setForm(settings);
  }, [open, settings]);

  function handleSave() {
    updateSettings(form);
    toast('設定已儲存', 'success');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>店家資訊設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {FIELDS.map(({ key, label, placeholder, multiline }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              {multiline ? (
                <textarea
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={2}
                  className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              ) : (
                <Input
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>儲存設定</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
