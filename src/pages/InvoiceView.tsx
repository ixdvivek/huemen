import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Icon, Menu, Money, StateBadge, TopBar } from '../components/ui';
import { InvoiceDoc } from '../components/Documents';
import { invoiceState, paidFor } from '../lib/calc';
import { fmtDate, methodLabel } from '../lib/format';
import { shareAsImage, shareAsPdf } from '../lib/share';
import PaymentForm from './PaymentForm';

export default function InvoiceView() {
  const { id } = useParams();
  const s = useStore();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [paying, setPaying] = useState(false);
  const [sharing, setSharing] = useState<'img' | 'pdf' | null>(null);

  const invoice = s.invoices.find((i) => i.id === id);
  const project = s.projects.find((p) => p.id === invoice?.project_id);
  if (!invoice || !project) return <Navigate to="/invoices" replace />;
  const client = s.clients.find((c) => c.id === project.client_id);
  const paid = paidFor(invoice.id, s.payments);
  const state = invoiceState(invoice, paid);
  const payments = s.payments.filter((p) => p.invoice_id === invoice.id).sort((a, b) => a.date.localeCompare(b.date));
  const filename = `${invoice.number}-${(client?.company || client?.name || project.title).replace(/[^\w]+/g, '-')}`;

  const share = async (kind: 'img' | 'pdf') => {
    if (!ref.current || sharing) return;
    setSharing(kind);
    try {
      const title = `${invoice.number} · ${s.settings.businessName || 'Invoice'}`;
      const res = kind === 'img' ? await shareAsImage(ref.current, filename, title) : await shareAsPdf(ref.current, filename, title);
      if (res !== 'cancelled') {
        if (invoice.status === 'draft') await s.save('invoices', { status: 'sent' }, invoice.id);
        await s.log(project.id, 'shared', res === 'shared' ? 'Invoice shared' : 'Invoice downloaded', `${invoice.number} · ${kind === 'img' ? 'image' : 'PDF'}`);
        if (res === 'downloaded') s.notify(kind === 'img' ? 'Image downloaded' : 'PDF downloaded');
      }
    } catch (e) {
      console.error(e);
      s.notify("Couldn't create the file. Try again.");
    } finally {
      setSharing(null);
    }
  };

  const setStatus = async (status: 'sent' | 'void' | 'draft') => {
    await s.save('invoices', { status }, invoice.id);
    if (status === 'void') await s.log(project.id, 'invoice', 'Invoice voided', invoice.number);
  };
  const del = async () => {
    if (!confirm(`Delete ${invoice.number}${payments.length ? ' and its payments' : ''}? This can't be undone.`)) return;
    await s.remove('invoices', invoice.id);
    nav(`/projects/${project.id}`, { replace: true });
  };

  const menu = [
    { label: 'Edit invoice', onClick: () => nav(`/invoices/${invoice.id}/edit`) },
    { label: 'Open project', onClick: () => nav(`/projects/${project.id}`) },
    invoice.status === 'draft'
      ? { label: 'Mark as sent', onClick: () => setStatus('sent') }
      : invoice.status === 'void'
        ? { label: 'Restore invoice', onClick: () => setStatus('sent') }
        : { label: 'Void invoice', onClick: () => setStatus('void') },
    { label: 'Delete invoice', onClick: del, danger: true },
  ];

  return (
    <div className="app" style={{ gap: 14 }}>
      <TopBar title={invoice.number} right={<Menu items={menu} />} />
      <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
        <StateBadge state={state} />
        <span className="xs muted">{state === 'draft' ? 'Sharing marks it as sent' : project.title}</span>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <div className="grid2">
          <button className="btn btn-light" disabled={!!sharing} onClick={() => share('img')}>
            <Icon name="image" size={16} /> {sharing === 'img' ? 'Preparing…' : 'Share image'}
          </button>
          <button className="btn btn-light" disabled={!!sharing} onClick={() => share('pdf')}>
            <Icon name="pdf" size={16} /> {sharing === 'pdf' ? 'Preparing…' : 'Share PDF'}
          </button>
        </div>
        {state !== 'paid' && state !== 'void' && (
          <button className="btn btn-dark btn-block" onClick={() => setPaying(true)}>
            <Icon name="check" size={16} /> Record payment
          </button>
        )}
      </div>

      <div style={{ margin: '0 -12px' }}>
        <InvoiceDoc
          ref={ref}
          invoice={invoice}
          project={project}
          client={client}
          settings={s.settings}
          payments={s.payments}
          invoices={s.invoices}
          deliverables={s.deliverables}
        />
      </div>

      {payments.length > 0 && (
        <div className="stack">
          <div className="section-title">Payments</div>
          <div className="list">
            {payments.map((p) => (
              <Link key={p.id} to={`/receipts/${p.id}`} className="list-row">
                <span className="avatar" style={{ background: 'var(--green-soft)', color: 'var(--green-ink)' }}><Icon name="check" /></span>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="strong"><Money v={p.amount} c={project.currency} /></span>
                  <span className="xs muted">{fmtDate(p.date)} · {methodLabel[p.method]}</span>
                </span>
                <span className="xs strong row" style={{ gap: 4 }}>Receipt <Icon name="chevron" size={14} /></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {paying && <PaymentForm invoices={[invoice]} onClose={() => setPaying(false)} />}
    </div>
  );
}
