import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Avatar, Empty, Icon, Menu, Money, Progress, Seg, StateBadge, TopBar } from '../components/ui';
import { invoiceState, paidFor, pct, projectSummary } from '../lib/calc';
import { deliverableStatusLabel, fmtDate, fmtDateTime, fmtHours, initials, invoiceTypeLabel, methodLabel, money, projectStatusLabel } from '../lib/format';
import type { Activity, Deliverable } from '../lib/types';
import ProjectForm from './ProjectForm';
import DeliverableForm from './DeliverableForm';
import PaymentForm from './PaymentForm';

type Tab = 'scope' | 'invoices' | 'payments' | 'activity';

const tlStyle: Record<Activity['kind'], { bg: string; fg: string; icon: string }> = {
  payment: { bg: 'var(--green-soft)', fg: 'var(--green-ink)', icon: 'check' },
  shared: { bg: 'transparent', fg: 'var(--ink)', icon: 'send' },
  scope: { bg: 'var(--accent-soft)', fg: 'var(--accent-ink)', icon: 'plus' },
  invoice: { bg: 'transparent', fg: 'var(--ink)', icon: 'doc' },
  project: { bg: 'var(--chip)', fg: 'var(--ink)', icon: 'folder' },
  deliverable: { bg: 'transparent', fg: 'var(--ink)', icon: 'layers' },
  status: { bg: 'transparent', fg: 'var(--ink)', icon: 'refresh' },
};

export default function ProjectPage() {
  const { id } = useParams();
  const s = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('invoices');
  const [editing, setEditing] = useState(false);
  const [deliv, setDeliv] = useState<Deliverable | 'new' | null>(null);
  const [paying, setPaying] = useState(false);

  const project = s.projects.find((p) => p.id === id);
  if (!project) return <Navigate to="/" replace />;

  const client = s.clients.find((c) => c.id === project.client_id);
  const c = project.currency;
  const sum = projectSummary(project, s.deliverables, s.invoices, s.payments);
  const deliverables = s.deliverables.filter((d) => d.project_id === project.id);
  const invoices = s.invoices.filter((i) => i.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const payments = s.payments.filter((p) => p.project_id === project.id).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const activity = s.activity.filter((a) => a.project_id === project.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unpaid = invoices
    .filter((i) => i.status !== 'void' && paidFor(i.id, s.payments) < i.total - 0.005)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const hasDraftFinal = invoices.some((i) => i.type === 'final' && i.status !== 'void');
  const statusCls = project.status === 'active' ? 'b-green' : project.status === 'on_hold' ? 'b-gray' : 'b-dark';

  const del = async () => {
    if (!confirm(`Delete “${project.title}” with all its invoices and payments? This can't be undone.`)) return;
    try {
      await s.remove('projects', project.id);
      nav('/');
    } catch (e: any) {
      s.notify(e.message);
    }
  };
  const setStatus = async (status: 'active' | 'completed') => {
    await s.save('projects', { status }, project.id);
    await s.log(project.id, 'status', status === 'completed' ? 'Project completed' : 'Project reopened', project.title);
  };

  return (
    <div className="app">
      <TopBar
        title="Project"
        back="/"
        right={
          <Menu
            items={[
              { label: 'Edit project', onClick: () => setEditing(true) },
              project.status === 'completed'
                ? { label: 'Reopen project', onClick: () => setStatus('active') }
                : { label: 'Mark as completed', onClick: () => setStatus('completed') },
              { label: 'Delete project', onClick: del, danger: true },
            ]}
          />
        }
      />

      <div className="card-lg">
        <div className="row" style={{ padding: '12px 12px 8px' }}>
          <Avatar large text={initials(client?.company || client?.name || project.title)} seed={project.client_id ?? project.id} />
          <div className="grow">
            <div className="small muted ellipsis">{client ? [client.company, client.name].filter(Boolean).join(' · ') : 'No client'}</div>
            <div className="ellipsis" style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>{project.title}</div>
          </div>
          <span className={'badge ' + statusCls}>{projectStatusLabel[project.status]}</span>
        </div>
        <div className="inset">
          <div className="between small" style={{ color: 'var(--ink-2)' }}>
            <span>Received · {c}</span>
            <span>{project.rates[0] ? `${project.rates[0].name} ${money(project.rates[0].amount, c)}/hr` : ''}</span>
          </div>
          <div className="amount-xl">
            <Money v={sum.received} c={c} /> <span className="amount-of">/ <Money v={sum.value} c={c} /></span>
          </div>
          <Progress value={pct(sum.received, sum.value)} green={project.status === 'completed'} />
          <div className="grid3" style={{ paddingTop: 4 }}>
            <Stat label="Invoiced" value={<Money v={sum.invoiced} c={c} />} />
            <Stat label="Outstanding" value={<Money v={sum.outstanding} c={c} />} accent={sum.outstanding > 0} />
            <Stat label="To invoice" value={<Money v={sum.toInvoice} c={c} />} />
          </div>
        </div>
      </div>

      <div className="grid2">
        <Link to={`/projects/${project.id}/invoices/new`} className="btn btn-dark">
          <Icon name="plus" size={16} stroke={2.2} /> New invoice
        </Link>
        <button className="btn btn-light" onClick={() => setPaying(true)}>
          <Icon name="check" size={16} /> Record payment
        </button>
      </div>

      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'scope', label: 'Scope' },
          { value: 'invoices', label: 'Invoices' },
          { value: 'payments', label: 'Payments' },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'scope' && (
        <div className="stack">
          {deliverables.length === 0 ? (
            <Empty>
              List what you're delivering — fixed-price items or hours × rate. Their total becomes the project value.
            </Empty>
          ) : (
            <div className="list">
              {deliverables.map((d) => (
                <button key={d.id} className="list-row" onClick={() => setDeliv(d)}>
                  <span className="dot" style={{ background: d.status === 'done' ? 'var(--green)' : d.status === 'in_progress' ? 'var(--accent)' : '#C9C5BF' }} />
                  <span className="grow stack" style={{ gap: 2 }}>
                    <span className="strong" style={{ fontSize: 15 }}>
                      {d.title} {d.is_additional && <span className="badge b-accent" style={{ marginLeft: 4 }}>Additional</span>}
                    </span>
                    <span className="xs muted">
                      {d.kind === 'hourly' && d.hours != null && d.rate != null ? `${fmtHours(d.hours)} × ${money(d.rate, c)}` : 'Fixed'} · {deliverableStatusLabel[d.status]}
                    </span>
                  </span>
                  <span className="strong small"><Money v={d.amount} c={c} /></span>
                </button>
              ))}
            </div>
          )}
          <button className="dashed-btn" onClick={() => setDeliv('new')}>
            <span className="avatar" style={{ background: 'var(--tray)' }}><Icon name="plus" /></span>
            <span className="strong">Add deliverable</span>
          </button>
          {deliverables.length > 0 && (
            <div className="between small" style={{ padding: '0 4px' }}>
              <span className="muted">Project value</span>
              <span className="strong"><Money v={sum.value} c={c} /></span>
            </div>
          )}
        </div>
      )}

      {tab === 'invoices' && (
        <div className="stack">
          {invoices.length === 0 && <Empty>No invoices yet. Start with an advance — it's one tap.</Empty>}
          {invoices.map((inv) => {
            const paid = paidFor(inv.id, s.payments);
            const st = invoiceState(inv, paid);
            const due = inv.total - paid;
            return (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="card row" style={{ padding: '14px 16px' }}>
                <span className="avatar icon"><Icon name="doc" /></span>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="strong ellipsis" style={{ fontSize: 15 }}>{invoiceTypeLabel[inv.type]}</span>
                  <span className="xs muted">
                    {inv.number} · {st === 'paid' ? 'Paid' : inv.due_date ? `Due ${fmtDate(inv.due_date, false)}` : fmtDate(inv.issue_date, false)}
                  </span>
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className="strong" style={{ fontSize: 15 }}><Money v={inv.total} c={c} /></span>
                  {st === 'partial' || (st === 'overdue' && paid > 0) ? (
                    <StateBadge state={st} text={`${money(due, c)} due`} />
                  ) : (
                    <StateBadge state={st} />
                  )}
                </span>
              </Link>
            );
          })}
          {sum.toInvoice > 0 && invoices.length > 0 && !hasDraftFinal && (
            <Link to={`/projects/${project.id}/invoices/new?type=final`} className="dashed-btn">
              <span className="avatar" style={{ background: 'var(--tray)' }}><Icon name="plus" /></span>
              <span className="grow stack" style={{ gap: 2 }}>
                <span className="strong" style={{ fontSize: 15 }}>Final settlement</span>
                <span className="xs muted">Bill the remaining balance</span>
              </span>
              <span className="strong"><Money v={sum.toInvoice} c={c} /></span>
            </Link>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="stack">
          {payments.length === 0 ? (
            <Empty>Payments you record show up here, each with its own receipt.</Empty>
          ) : (
            <div className="list">
              {payments.map((p) => {
                const inv = s.invoices.find((i) => i.id === p.invoice_id);
                return (
                  <Link key={p.id} to={`/receipts/${p.id}`} className="list-row">
                    <span className="avatar" style={{ background: 'var(--green-soft)', color: 'var(--green-ink)' }}><Icon name="check" /></span>
                    <span className="grow stack" style={{ gap: 2 }}>
                      <span className="strong" style={{ fontSize: 15 }}><Money v={p.amount} c={c} /></span>
                      <span className="xs muted">{fmtDate(p.date)} · {methodLabel[p.method]} · {inv?.number}</span>
                    </span>
                    <span className="xs muted">{p.number}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card">
          {activity.length === 0 ? (
            <div className="small muted">Nothing yet.</div>
          ) : (
            <div className="timeline">
              {activity.map((a) => {
                const st = tlStyle[a.kind] ?? tlStyle.project;
                return (
                  <div key={a.id} className="tl-item">
                    <div className="tl-icon" style={{ background: st.bg, color: st.fg, borderColor: st.bg === 'transparent' ? 'var(--line-2)' : st.bg }}>
                      <Icon name={st.icon} size={16} stroke={2.2} />
                    </div>
                    <div className="stack" style={{ gap: 2 }}>
                      <span className="xs muted">{fmtDateTime(a.created_at)}</span>
                      <span className="small" style={{ fontWeight: 500 }}>{a.title}</span>
                      {a.detail && <span className="small strong">{a.detail}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
      {deliv && <DeliverableForm project={project} item={deliv === 'new' ? undefined : deliv} onClose={() => setDeliv(null)} />}
      {paying && <PaymentForm invoices={unpaid} onClose={() => setPaying(false)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="xs muted">{label}</span>
      <span className="strong small" style={{ fontSize: 14, color: accent ? 'var(--accent-ink)' : undefined }}>{value}</span>
    </div>
  );
}
