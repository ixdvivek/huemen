import { round2, today } from './format';
import type { Deliverable, Invoice, InvoiceItem, Payment, Project } from './types';

export type InvoiceState = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';

export const itemsSubtotal = (items: InvoiceItem[]) => round2(items.reduce((s, i) => s + (i.amount || 0), 0));

export function paidFor(invoiceId: string, payments: Payment[]) {
  return round2(payments.filter((p) => p.invoice_id === invoiceId).reduce((s, p) => s + p.amount, 0));
}

export function invoiceState(inv: Invoice, paid: number): InvoiceState {
  if (inv.status === 'void') return 'void';
  if (paid >= inv.total - 0.005 && inv.total > 0) return 'paid';
  if (paid > 0) return inv.due_date && inv.due_date < today() ? 'overdue' : 'partial';
  if (inv.status === 'draft') return 'draft';
  if (inv.due_date && inv.due_date < today()) return 'overdue';
  return 'sent';
}

export const stateLabel: Record<InvoiceState, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Part paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export interface MoneySummary {
  value: number;
  invoiced: number;
  received: number;
  outstanding: number;
  toInvoice: number;
}

export function projectSummary(
  project: Project,
  deliverables: Deliverable[],
  invoices: Invoice[],
  payments: Payment[],
): MoneySummary {
  const value = round2(deliverables.filter((d) => d.project_id === project.id).reduce((s, d) => s + d.amount, 0));
  const invs = invoices.filter((i) => i.project_id === project.id && i.status !== 'void');
  const invoiced = round2(invs.reduce((s, i) => s + i.total, 0));
  const ids = new Set(invs.map((i) => i.id));
  const received = round2(payments.filter((p) => ids.has(p.invoice_id)).reduce((s, p) => s + p.amount, 0));
  return {
    value,
    invoiced,
    received,
    outstanding: Math.max(0, round2(invoiced - received)),
    toInvoice: Math.max(0, round2(value - invoiced)),
  };
}

export function invoicedDeliverableIds(invoices: Invoice[], exceptInvoiceId?: string) {
  const s = new Set<string>();
  for (const inv of invoices) {
    if (inv.status === 'void' || inv.id === exceptInvoiceId) continue;
    for (const it of inv.items) if (it.deliverable_id) s.add(it.deliverable_id);
  }
  return s;
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0);
