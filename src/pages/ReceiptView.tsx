import { useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Icon, Menu, TopBar } from '../components/ui';
import { ReceiptDoc } from '../components/Documents';
import { money } from '../lib/format';
import { shareAsImage, shareAsPdf } from '../lib/share';

export default function ReceiptView() {
  const { id } = useParams();
  const s = useStore();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState<'img' | 'pdf' | null>(null);

  const payment = s.payments.find((p) => p.id === id);
  const invoice = s.invoices.find((i) => i.id === payment?.invoice_id);
  const project = s.projects.find((p) => p.id === payment?.project_id);
  if (!payment || !invoice || !project) return <Navigate to="/invoices" replace />;
  const client = s.clients.find((c) => c.id === project.client_id);
  const filename = `${payment.number}-${(client?.company || client?.name || project.title).replace(/[^\w]+/g, '-')}`;

  const share = async (kind: 'img' | 'pdf') => {
    if (!ref.current || sharing) return;
    setSharing(kind);
    try {
      const title = `Receipt ${payment.number} · ${s.settings.businessName || ''}`;
      const res = kind === 'img' ? await shareAsImage(ref.current, filename, title) : await shareAsPdf(ref.current, filename, title);
      if (res !== 'cancelled') await s.log(project.id, 'shared', 'Receipt shared', `${payment.number} · ${money(payment.amount, project.currency)}`);
      if (res === 'downloaded') s.notify(kind === 'img' ? 'Image downloaded' : 'PDF downloaded');
    } catch (e) {
      console.error(e);
      s.notify("Couldn't create the file. Try again.");
    } finally {
      setSharing(null);
    }
  };

  const del = async () => {
    if (!confirm(`Delete payment ${payment.number} (${money(payment.amount, project.currency)})? The invoice will show as unpaid again.`)) return;
    await s.remove('payments', payment.id);
    await s.log(project.id, 'payment', 'Payment deleted', `${money(payment.amount, project.currency)} on ${invoice.number}`);
    nav(`/invoices/${invoice.id}`, { replace: true });
  };

  return (
    <div className="app" style={{ gap: 14 }}>
      <TopBar
        title={`Receipt ${payment.number}`}
        right={
          <Menu
            items={[
              { label: `Open ${invoice.number}`, onClick: () => nav(`/invoices/${invoice.id}`) },
              { label: 'Open project', onClick: () => nav(`/projects/${project.id}`) },
              { label: 'Delete payment', onClick: del, danger: true },
            ]}
          />
        }
      />
      <div className="grid2">
        <button className="btn btn-dark" disabled={!!sharing} onClick={() => share('img')}>
          <Icon name="image" size={16} /> {sharing === 'img' ? 'Preparing…' : 'Share image'}
        </button>
        <button className="btn btn-light" disabled={!!sharing} onClick={() => share('pdf')}>
          <Icon name="pdf" size={16} /> {sharing === 'pdf' ? 'Preparing…' : 'Share PDF'}
        </button>
      </div>
      <div style={{ margin: '0 -12px' }}>
        <ReceiptDoc ref={ref} payment={payment} invoice={invoice} project={project} client={client} settings={s.settings} payments={s.payments} />
      </div>
    </div>
  );
}
