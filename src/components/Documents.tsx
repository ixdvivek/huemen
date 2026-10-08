import { forwardRef, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { itemsSubtotal, paidFor, projectSummary } from '../lib/calc';
import { currencyName, daysBetween, fmtDate, initials, invoiceTypeLabel, methodLabel, money, moneyParts, round2, today } from '../lib/format';
import type { Client, Deliverable, Invoice, Payment, Project, Settings } from '../lib/types';

function Brand({ settings, sub }: { settings: Settings; sub: string }) {
  return (
    <div className="row" style={{ gap: 10, minWidth: 0 }}>
      <div className="logo">{settings.logo ? <img src={settings.logo} alt="" /> : initials(settings.businessName || 'My Studio')}</div>
      <div className="stack" style={{ gap: 1, minWidth: 0 }}>
        <div className="strong ellipsis" style={{ fontSize: 15 }}>{settings.businessName || 'Your business name'}</div>
        <div className="xs muted ellipsis">{sub}</div>
      </div>
    </div>
  );
}

function BigAmount({ v, c }: { v: number; c: Project['currency'] }) {
  const [whole, dec] = moneyParts(v, c);
  return (
    <div className="big num">
      {whole}
      <small>{dec}</small>
    </div>
  );
}

function useQr(text: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!text) {
      setSrc(null);
      return;
    }
    QRCode.toDataURL(text, { margin: 0, width: 288, errorCorrectionLevel: 'M', color: { dark: '#18181B', light: '#FFFFFF' } }).then(setSrc, () => setSrc(null));
  }, [text]);
  return src;
}

const accentByType: Record<Invoice['type'], [string, string]> = {
  advance: ['var(--blue-soft)', 'var(--blue-ink)'],
  milestone: ['var(--accent-soft)', 'var(--accent-ink)'],
  additional: ['#EDE3F7', '#5B2F86'],
  final: ['var(--green-soft)', 'var(--green-ink)'],
  custom: ['var(--chip)', 'var(--ink-2)'],
};

interface InvoiceDocProps {
  invoice: Invoice;
  project: Project;
  client?: Client;
  settings: Settings;
  payments: Payment[];
  invoices: Invoice[];
  deliverables: Deliverable[];
}

export const InvoiceDoc = forwardRef<HTMLDivElement, InvoiceDocProps>(function InvoiceDoc(
  { invoice, project, client, settings, payments, invoices, deliverables },
  ref,
) {
  const c = project.currency;
  const paid = paidFor(invoice.id, payments);
  const due = Math.max(0, round2(invoice.total - paid));
  const subtotal = itemsSubtotal(invoice.items);
  const sum = projectSummary(project, deliverables, invoices, payments);
  const isPaid = due <= 0.005 && invoice.total > 0;
  const days = invoice.due_date ? daysBetween(today(), invoice.due_date) : null;
  const upi =
    c === 'INR' && settings.upiId && due > 0
      ? `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(settings.upiName || settings.businessName || '')}&am=${due.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`
      : null;
  const qr = useQr(upi);
  const [bg, fg] = accentByType[invoice.type];
  const bankLines = [
    settings.upiId && `UPI · ${settings.upiId}`,
    settings.accountName && `${settings.accountName}`,
    settings.accountNumber && `A/c · ${settings.accountNumber}`,
    settings.ifsc && `IFSC · ${settings.ifsc}`,
    settings.bankName,
  ].filter(Boolean) as string[];
  const contact = [settings.email, settings.phone].filter(Boolean).join(' · ');

  return (
    <div className="doc-wrap" ref={ref}>
      <div className="doc">
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <Brand settings={settings} sub={contact || settings.address || ' '} />
          <span className="badge" style={{ background: bg, color: fg, height: 26, fontSize: 12, padding: '0 10px' }}>
            {invoiceTypeLabel[invoice.type]}
          </span>
        </div>

        <div className="stack" style={{ gap: 4 }}>
          <div className="eyebrow">INVOICE</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>{invoice.number}</div>
          <div className="small muted">
            Issued {fmtDate(invoice.issue_date)}
            {invoice.due_date ? ` · Due ${fmtDate(invoice.due_date)}` : ''}
          </div>
        </div>

        <div className="due-box">
          <div className="small strong" style={{ color: 'var(--ink-2)' }}>{isPaid ? 'Paid in full' : paid > 0 ? 'Balance due' : 'Amount due'}</div>
          <BigAmount v={isPaid ? invoice.total : due} c={c} />
          <div className="small" style={{ color: 'var(--ink-2)' }}>
            {currencyName(c)}
            {!isPaid && days != null && (days > 0 ? ` · due in ${days} day${days === 1 ? '' : 's'}` : days === 0 ? ' · due today' : ` · ${-days} day${days === -1 ? '' : 's'} overdue`)}
            {paid > 0 && !isPaid && ` · ${money(paid, c)} received`}
          </div>
        </div>

        <div className="grid2" style={{ gap: 16 }}>
          <div className="stack" style={{ gap: 4 }}>
            <div className="label">Billed to</div>
            <div className="strong" style={{ fontSize: 14 }}>{client?.company || client?.name || '—'}</div>
            <div className="small pre" style={{ color: 'var(--ink-2)' }}>
              {[client?.company ? client.name : null, client?.address].filter(Boolean).join('\n')}
            </div>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <div className="label">Project</div>
            <div className="strong" style={{ fontSize: 14 }}>{project.title}</div>
          </div>
        </div>

        <div className="stack" style={{ gap: 0 }}>
          <div className="label" style={{ paddingBottom: 6 }}>Items</div>
          <div className="items">
            {invoice.items.map((it, i) => (
              <div key={i}>
                <div className="stack" style={{ gap: 2 }}>
                  <span className="strong">{it.title}</span>
                  {it.detail && <span className="xs muted">{it.detail}</span>}
                </div>
                <span className="strong num">{money(it.amount, c)}</span>
              </div>
            ))}
            {invoice.discount > 0 && (
              <>
                <div>
                  <span className="muted">Subtotal</span>
                  <span className="num">{money(subtotal, c)}</span>
                </div>
                <div>
                  <span className="muted">Discount</span>
                  <span className="num">− {money(invoice.discount, c)}</span>
                </div>
              </>
            )}
            <div className="total">
              <span>Total</span>
              <span className="num">{money(invoice.total, c, true)}</span>
            </div>
          </div>
        </div>

        {sum.value > 0 && invoice.type !== 'custom' && (
          <div className="boxed">
            <div className="between"><span className="muted">Project value</span><span className="strong num">{money(sum.value, c)}</span></div>
            <div className="between"><span className="muted">Paid so far</span><span className="strong num">{money(sum.received, c)}</span></div>
            <div className="between"><span className="muted">Not yet invoiced</span><span className="strong num">{money(sum.toInvoice, c)}</span></div>
          </div>
        )}

        {!isPaid && c === 'INR' && (qr || bankLines.length > 0) && (
          <div className="pay">
            {qr && (
              <div className="qr">
                <img src={qr} alt="UPI QR code" />
              </div>
            )}
            <div className="stack" style={{ gap: 6, minWidth: 0 }}>
              <div className="small" style={{ fontWeight: 700 }}>{qr ? 'Scan to pay with UPI' : 'Payment details'}</div>
              <div className="xs pre" style={{ color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'break-word' }}>{bankLines.join('\n')}</div>
              {qr && <div className="xs muted">Amount fills in automatically</div>}
            </div>
          </div>
        )}
        {!isPaid && c === 'USD' && settings.usdDetails && (
          <div className="pay" style={{ display: 'block' }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>How to pay</div>
            <div className="xs pre" style={{ color: 'var(--ink-2)' }}>{settings.usdDetails}</div>
          </div>
        )}

        {invoice.notes && (
          <div className="stack" style={{ gap: 4 }}>
            <div className="label">Note</div>
            <div className="small pre" style={{ color: 'var(--ink-2)' }}>{invoice.notes}</div>
          </div>
        )}

        <div className="foot">
          <span className="ellipsis">{[settings.businessName, settings.address?.split('\n')[0]].filter(Boolean).join(' · ')}</span>
          <span>{invoice.number}</span>
        </div>
      </div>
    </div>
  );
});

interface ReceiptDocProps {
  payment: Payment;
  invoice: Invoice;
  project: Project;
  client?: Client;
  settings: Settings;
  payments: Payment[];
}

export const ReceiptDoc = forwardRef<HTMLDivElement, ReceiptDocProps>(function ReceiptDoc(
  { payment, invoice, project, client, settings, payments },
  ref,
) {
  const c = project.currency;
  // balance as of this receipt (payments up to and including this one)
  const upTo = payments
    .filter((p) => p.invoice_id === invoice.id)
    .filter((p) => p.date < payment.date || (p.date === payment.date && p.created_at <= payment.created_at));
  const paidToDate = round2(upTo.reduce((s, p) => s + p.amount, 0));
  const balance = Math.max(0, round2(invoice.total - paidToDate));
  const full = balance <= 0.005;
  const contact = [settings.email, settings.phone].filter(Boolean).join(' · ');
  const pctPaid = invoice.total > 0 ? Math.min(100, (paidToDate / invoice.total) * 100) : 0;

  return (
    <div className="doc-wrap" ref={ref}>
      <div className="doc">
        <div className="between">
          <Brand settings={settings} sub={`Receipt ${payment.number}`} />
          <span className={'badge ' + (full ? 'b-green' : 'b-accent')} style={{ height: 26, fontSize: 12, padding: '0 10px' }}>
            {full ? 'Paid in full' : 'Part payment'}
          </span>
        </div>

        <div className="stack" style={{ alignItems: 'center', gap: 8, padding: '12px 0 4px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div className="small strong" style={{ color: 'var(--ink-2)', paddingTop: 4 }}>Payment received</div>
          <BigAmount v={payment.amount} c={c} />
          <div className="small muted">{fmtDate(payment.date)}</div>
        </div>

        <div className="kv" style={{ borderTop: '1px dashed var(--dash)' }}>
          <div><span>Received from</span><span>{client?.company || client?.name || '—'}</span></div>
          <div><span>For</span><span>{invoice.number} · {invoiceTypeLabel[invoice.type]}</span></div>
          <div><span>Project</span><span>{project.title}</span></div>
          <div><span>Method</span><span>{methodLabel[payment.method]}</span></div>
          {payment.reference && <div><span>Reference</span><span style={{ wordBreak: 'break-all' }}>{payment.reference}</span></div>}
        </div>

        <div className="due-box" style={{ gap: 10 }}>
          <div className="between small" style={{ color: 'var(--ink-2)' }}>
            <span>Invoice {invoice.number}</span>
            <span>{money(invoice.total, c)} total</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }} className="num">
            {money(paidToDate, c)} <span style={{ fontWeight: 500, color: 'var(--faint)' }}>/ {money(invoice.total, c)} paid</span>
          </div>
          <div className="progress green"><div style={{ width: `${pctPaid}%` }} /></div>
          <div className="between small">
            <span style={{ color: 'var(--ink-2)' }}>Balance due</span>
            <span style={{ fontWeight: 700, color: full ? 'var(--green-ink)' : 'var(--accent-ink)' }} className="num">{full ? 'Nil' : money(balance, c)}</span>
          </div>
        </div>

        {payment.notes && <div className="small pre" style={{ color: 'var(--ink-2)' }}>{payment.notes}</div>}

        <div className="small" style={{ color: 'var(--ink-2)', lineHeight: 1.5, textAlign: 'center' }}>
          {settings.receiptNote || 'Thank you for the payment.'}
          <br />
          This receipt confirms the amount above was received.
        </div>

        <div className="foot">
          <span className="ellipsis">{[settings.businessName, contact].filter(Boolean).join(' · ')}</span>
          <span>{payment.number}</span>
        </div>
      </div>
    </div>
  );
});
