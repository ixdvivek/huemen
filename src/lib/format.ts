import type { Currency, InvoiceType, PaymentMethod, ProjectStatus, DeliverableStatus } from './types';

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(currency: Currency, decimals: number) {
  const key = currency + decimals;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    fmtCache.set(key, f);
  }
  return f;
}

/** ₹1,50,000 / $1,200 — decimals only when there are paise/cents, unless `exact`. */
export function money(amount: number, currency: Currency, exact = false) {
  const v = round2(amount || 0);
  const decimals = exact || !Number.isInteger(v) ? 2 : 0;
  return nf(currency, decimals).format(v);
}

/** Splits "₹78,000.00" into ["₹78,000", ".00"] for the big amount style. */
export function moneyParts(amount: number, currency: Currency): [string, string] {
  const s = nf(currency, 2).format(round2(amount || 0));
  const i = s.lastIndexOf('.');
  return i === -1 ? [s, ''] : [s.slice(0, i), s.slice(i)];
}

export const currencySymbol = (c: Currency) => (c === 'INR' ? '₹' : '$');
export const currencyName = (c: Currency) => (c === 'INR' ? 'Indian Rupee' : 'US Dollar');

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/* dates — stored as YYYY-MM-DD, local */
export function today(): string {
  const d = new Date();
  return toISODate(d);
}
export function toISODate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}
export function fmtDate(iso: string | null | undefined, withYear = true) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}
export function fmtDateTime(ts: string) {
  const d = new Date(ts);
  const isToday = toISODate(d) === today();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}
export function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 864e5);
}

export function nextNumber(prefix: string, existing: string[]) {
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix)) continue;
    const v = parseInt(n.slice(prefix.length), 10);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return prefix + String(max + 1).padStart(4, '0');
}

export const invoiceTypeLabel: Record<InvoiceType, string> = {
  advance: 'Advance',
  milestone: 'Mid-project fee',
  additional: 'Additional work',
  final: 'Final settlement',
  custom: 'Invoice',
};

export const methodLabel: Record<PaymentMethod, string> = {
  upi: 'UPI',
  bank: 'Bank transfer',
  wise: 'Wise',
  paypal: 'PayPal',
  card: 'Card',
  cash: 'Cash',
  other: 'Other',
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};

export const deliverableStatusLabel: Record<DeliverableStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
};

export function initials(s: string | null | undefined) {
  const parts = (s ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '–';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? '')).toUpperCase();
}

export function fmtHours(h: number) {
  return `${round2(h)} hr${h === 1 ? '' : 's'}`;
}
