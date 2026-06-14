import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  return `$${Number(value).toLocaleString('zh-TW')}`;
}

export function formatDate(date: string | Date, fmt = 'YYYY-MM-DD'): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return fmt
    .replace('YYYY', String(y))
    .replace('MM', m)
    .replace('DD', day)
    .replace('HH', h)
    .replace('mm', min);
}
