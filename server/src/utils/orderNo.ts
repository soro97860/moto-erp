import dayjs from 'dayjs';

export function generateOrderNo(): string {
  const date = dayjs().format('YYYYMMDD');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${date}-${rand}`;
}
