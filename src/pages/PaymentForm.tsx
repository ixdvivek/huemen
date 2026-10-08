import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Field, Sheet, useBusy } from '../components/ui';
import { paidFor } from '../lib/calc';
import { currencySymbol, methodLabel, money, nextNumber, num, round2, today } from '../lib/format';
import type { Invoice, PaymentMethod } from '../lib/types';

export default function PaymentForm({ invoices, onClose }: { invoices: Invoice[]; onClose: () => void }) {
  const s = useStore();
  const nav = useNavigate();
  const { busy, run } = useBusy();
  const [invoiceId, setInvoiceId] = useState(invoices[0]?.id ?? '');
  const inv = invoices.find((i) => i.id === invoiceId);
  const project = s.projects.find((p) => p.id === inv?.project_id);
  const currency = project?.currency ?? 'INR';
  const balance = inv ? round2(inv.total - paidFor(inv.id, s.payments)) : 0;
  const [amount, setAmount] = useState(balance ? String(balance) : '');
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>(currency === 'INR' ? 'upi' : 'wise');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const pickInvoice = (id: string) => {
    setInvoiceId(id);
    const i = invoices.find((x) => x.id === id);
    if (i) setAmount(String(round2(i.total - paidFor(i.id, s.payments))));
  };

  const methods: PaymentMethod[] = currency === 'INR' ? ['upi', 'bank', 'cash', 'card', 'other'] : ['wise', 'bank', 'paypal', 'card', 'other'];

  const submit = () =>
    run(async () => {
      if (!inv || !project) throw new Error('Pick an invoice');
      const amt = round2(num(amount));
      if (amt <= 0) throw new Error('Enter the amount received');
      const pay = await s.save('payments', {
        invoice_id: inv.id,
        project_id: inv.project_id,
        number: nextNumber(s.settings.receiptPrefix || 'RCT-', s.payments.map((p) => p.number)),
        date,
        amount: amt,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      if (inv.status === 'draft') await s.save('invoices', { status: 'sent' }, inv.id);
      await s.log(inv.project_id, 'payment', 'Payment recorded', `${money(amt, currency)} on ${inv.number} · ${methodLabel[method]}`);
      onClose();
      nav(`/receipts/${pay.id}`);
    }, 'Payment recorded');

  if (!invoices.length)
    return (
      <Sheet title="Record payment" onClose={onClose}>
        <div className="empty">Nothing to record — all invoices here are paid. Create an invoice first.</div>
      </Sheet>
    );

  return (
    <Sheet title="Record payment" onClose={onClose}>
      <div className="form-group">
        {invoices.length > 1 && (
          <Field label="For invoice">
            <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)}>
              {invoices.map((i) => {
                const pc = s.projects.find((p) => p.id === i.project_id)?.currency ?? 'INR';
                return (
                  <option key={i.id} value={i.id}>
                    {i.number} · {money(round2(i.total - paidFor(i.id, s.payments)), pc)} due
                  </option>
                );
              })}
            </select>
          </Field>
        )}
        {inv && invoices.length === 1 && (
          <div className="between small">
            <span className="muted">{inv.number}</span>
            <span className="strong">{money(balance, currency)} due</span>
          </div>
        )}
        <Field label="Amount received" hint={inv && num(amount) < balance && num(amount) > 0 ? `Part payment — ${money(round2(balance - num(amount)), currency)} will remain due.` : undefined}>
          <div className="input-affix">
            <b>{currencySymbol(currency)}</b>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </Field>
        <Field label="Date received">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="field">
          <span>Method</span>
          <div className="chips">
            {methods.map((m) => (
              <button key={m} className="chip" aria-pressed={method === m} onClick={() => setMethod(m)}>
                {methodLabel[m]}
              </button>
            ))}
          </div>
        </div>
        <Field label="Reference (optional)" hint={method === 'upi' ? 'UTR / transaction ID' : undefined}>
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label="Note on receipt (optional)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <button className="btn btn-dark btn-block" disabled={busy} onClick={submit}>
        {busy ? 'Saving…' : 'Save & create receipt'}
      </button>
    </Sheet>
  );
}
