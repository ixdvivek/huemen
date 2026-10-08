import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Avatar, Dock, Empty, Icon, Money, Progress, Seg } from '../components/ui';
import { paidFor, invoiceState, pct, projectSummary } from '../lib/calc';
import { initials, today } from '../lib/format';
import type { Currency } from '../lib/types';
import ProjectForm from './ProjectForm';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const s = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<'open' | 'completed'>('open');
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    const out: Record<Currency, { outstanding: number; overdue: number; count: number; received: number; payments: number }> = {
      INR: { outstanding: 0, overdue: 0, count: 0, received: 0, payments: 0 },
      USD: { outstanding: 0, overdue: 0, count: 0, received: 0, payments: 0 },
    };
    const projectCur = new Map(s.projects.map((p) => [p.id, p.currency]));
    for (const inv of s.invoices) {
      const c = projectCur.get(inv.project_id);
      if (!c || inv.status === 'void' || inv.status === 'draft') continue;
      const paid = paidFor(inv.id, s.payments);
      const due = inv.total - paid;
      if (due > 0.005) {
        out[c].outstanding += due;
        out[c].count++;
        if (invoiceState(inv, paid) === 'overdue') out[c].overdue++;
      }
    }
    const month = today().slice(0, 7);
    for (const p of s.payments) {
      const c = projectCur.get(p.project_id);
      if (c && p.date.startsWith(month)) {
        out[c].received += p.amount;
        out[c].payments++;
      }
    }
    return out;
  }, [s.invoices, s.payments, s.projects]);

  const open = s.projects.filter((p) => p.status !== 'completed');
  const done = s.projects.filter((p) => p.status === 'completed');
  const list = (tab === 'open' ? open : done).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const clientName = (id: string | null) => s.clients.find((c) => c.id === id);
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'short' });

  const outstandingCount = totals.INR.count + totals.USD.count;
  const overdueCount = totals.INR.overdue + totals.USD.overdue;
  const payCount = totals.INR.payments + totals.USD.payments;
  const name = s.settings.ownerName?.split(' ')[0];

  return (
    <div className="app">
      <div className="between">
        <Link to="/settings" className="row" style={{ gap: 8, height: 44, padding: '0 14px 0 6px', borderRadius: 999, background: 'var(--tray)', fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, overflow: 'hidden' }}>
            {s.settings.logo ? <img src={s.settings.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(s.settings.businessName || 'My Studio')}
          </span>
          {s.settings.businessName || 'Set up your studio'}
        </Link>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" aria-label={s.hideAmounts ? 'Show amounts' : 'Hide amounts'} onClick={s.toggleHide}>
            <Icon name={s.hideAmounts ? 'eyeOff' : 'eye'} />
          </button>
          <Link to="/settings" className="icon-btn" aria-label="Settings">
            <Icon name="settings" />
          </Link>
        </div>
      </div>

      <div>
        <div className="h-greet">{greeting()}{name ? `, ${name}` : ''}.</div>
        <div className="h-greet faint">What are we billing today?</div>
      </div>

      <div className="grid2">
        <Link to="/invoices" className="tray">
          <div className="tray-head">
            Outstanding <span className="faint"><Icon name="chevron" size={14} /></span>
          </div>
          <div className="tray-body">
            <CurrencyLines a={totals.INR.outstanding} b={totals.USD.outstanding} />
            <div className="xs muted">
              {outstandingCount} invoice{outstandingCount === 1 ? '' : 's'}
              {overdueCount ? ` · ${overdueCount} overdue` : ''}
            </div>
          </div>
        </Link>
        <Link to="/invoices?tab=paid" className="tray">
          <div className="tray-head">
            Received · {monthName} <span className="faint"><Icon name="chevron" size={14} /></span>
          </div>
          <div className="tray-body">
            <CurrencyLines a={totals.INR.received} b={totals.USD.received} />
            <div className="xs muted">
              {payCount} payment{payCount === 1 ? '' : 's'}
            </div>
          </div>
        </Link>
      </div>

      <div className="stack">
        <div className="between">
          <div className="section-title">Projects</div>
          {s.offline && <span className="xs muted row" style={{ gap: 6 }}><span className="sync-dot off" />Offline — showing saved copy</span>}
        </div>
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Active', count: open.length },
            { value: 'completed', label: 'Completed', count: done.length },
          ]}
        />
        {list.length === 0 && (
          <Empty>
            {tab === 'open' ? 'No active projects yet.' : 'Completed projects will show up here.'}
            {tab === 'open' && (
              <button className="btn btn-dark btn-sm" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} /> New project
              </button>
            )}
          </Empty>
        )}
        {list.map((p) => {
          const sum = projectSummary(p, s.deliverables, s.invoices, s.payments);
          const client = clientName(p.client_id);
          const progress = pct(sum.received, sum.value);
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="card stack" style={{ gap: 12 }}>
              <div className="row">
                <Avatar text={initials(client?.company || client?.name || p.title)} seed={p.client_id ?? p.id} />
                <div className="grow">
                  <div className="strong ellipsis" style={{ fontSize: 15 }}>{p.title}</div>
                  <div className="small muted ellipsis">{client ? client.company || client.name : 'No client'} · {p.currency}</div>
                </div>
                {p.status === 'on_hold' && <span className="badge b-gray">On hold</span>}
              </div>
              <div className="stack" style={{ gap: 6 }}>
                <div className="strong" style={{ fontSize: 15 }}>
                  <Money v={sum.received} c={p.currency} /> <span className="amount-of">/ <Money v={sum.value} c={p.currency} /></span>
                </div>
                <Progress value={progress} green={p.status === 'completed'} />
                <div className="xs muted">
                  {sum.value === 0
                    ? 'Add deliverables to set the project value'
                    : `Received ${Math.round(progress)}%` + (sum.outstanding > 0 ? ` · ` : '')}
                  {sum.value > 0 && sum.outstanding > 0 && (
                    <>
                      <Money v={sum.outstanding} c={p.currency} /> awaiting payment
                    </>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <Dock onAdd={() => setAdding(true)} addLabel="New project" />
      {adding && <ProjectForm onClose={() => setAdding(false)} onSaved={(p) => nav(`/projects/${p.id}`)} />}
    </div>
  );
}

function CurrencyLines({ a, b }: { a: number; b: number }) {
  // INR first; show USD below only when used.
  return (
    <>
      <div className="amount-l">
        <Money v={a} c="INR" />
      </div>
      <div className="strong" style={{ fontSize: 14, minHeight: 18 }}>
        {b > 0 ? (
          <>
            + <Money v={b} c="USD" />
          </>
        ) : (
          <span className="faint">+ <Money v={0} c="USD" /></span>
        )}
      </div>
    </>
  );
}
