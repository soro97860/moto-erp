import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShopSettings {
  name: string;
  address: string;
  phone: string;
  taxId: string;
  warranty: string;
  thankYou: string;
}

interface SettingsState {
  settings: ShopSettings;
  updateSettings: (s: Partial<ShopSettings>) => void;
  /** Called by SettingsPage after saving to DB; keeps local cache in sync */
  syncFromDB: (raw: Record<string, string>) => void;
}

const DEFAULT_SETTINGS: ShopSettings = {
  name: '機車行',
  address: '',
  phone: '',
  taxId: '',
  warranty: '維修項目自完工日起保固 30 天，零件耗材不在保固範圍內。',
  thankYou: '感謝您的光臨，歡迎再次惠顧！',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),
      syncFromDB: (raw) =>
        set({
          settings: {
            name:     raw.shopName     ?? DEFAULT_SETTINGS.name,
            address:  raw.shopAddress  ?? DEFAULT_SETTINGS.address,
            phone:    raw.shopPhone    ?? DEFAULT_SETTINGS.phone,
            taxId:    raw.shopTaxId    ?? DEFAULT_SETTINGS.taxId,
            warranty: raw.shopWarranty ?? DEFAULT_SETTINGS.warranty,
            thankYou: raw.shopThankYou ?? DEFAULT_SETTINGS.thankYou,
          },
        }),
    }),
    { name: 'moto-settings' },
  ),
);
