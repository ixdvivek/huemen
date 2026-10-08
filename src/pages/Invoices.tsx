import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Dock, Empty, Icon, Money, Seg, StateBadge } from '../components/ui';
import { invoiceState, paidFor } from '../lib/calc';
import { fmtDate, invoiceTypeLabel, money } from '../lib/format';

type Tab = 'unpaid' | 'paid' | 'all';

export default function Invoices() {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>((params.get('tab') as Tab) || 'unpaid');
  const setTab = (t: Tab) => {
    setTabState(t);
    setParams(t === 'unpaid' ? {} : { tab: t }, { replace: true });
  };

  const rows = s.invoices
    .map((inv) => {
      const paid = paidFor(inv.id, s.payments);
      const project = s.projects.find((p) => p.id === inv.project_id);
      const client = s.clients.find((c) => c.id === project?.client_id);
      return { inv, paid, state: invoiceState(inv, paid), project, client };
    })
    .filter((r) => r.project)
    .sort((a, b) => b.inv.issue_date.localeCompare(a.inv.issue_date) || b.inv.number.localeCompare(a.inv.number));

  const unpaid = rows.filter((r) => ['sent', 'partial', 'overdue', 'draft'].includes(r.state));
  const paid = rows.filter((r) => r.state === 'paid');
  const list = tab === 'unpaid' ? unpaid : tab === 'paid' ? paid : rows;

  return (
    <div className="app">
      <div className="h-greet">Invoices</div>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { value: 'unpaid', label: 'Unpaid', count: unpaid.length },
          { value: 'paid', label: 'Paid', count: paid.length },
          { value: 'all', label: 'All' },
        ]}
      />
      {list.length === 0 ? (
        <Empty>{tab === 'unpaid' ? 'All caught up — nothing waiting on payment.' : 'No invoices here yet. Create one from a project.'}</Empty>
      ) : (
        <div className="stack">
          {list.map(({ inv, paid, state, project, client }) => {
            const c = project!.currency;
            return (
              <Link key={inv.id} to={`/invoices/${inv.id}`} className="card row" style={{ padding: '14px 16px' }}>
                <span className="avatar icon"><Icon name="doc" /></span>
                <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="strong ellipsis" style={{ fontSize: 15 }}>{client?.company || client?.name || project!.title}</span>
                  <span className="xs muted ellipsis">
                    {inv.number} · {invoiceTypeLabel[inv.type]} · {fmtDate(inv.issue_date, false)}
                  </span>
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className="strong" style={{ fontSize: 15 }}><Money v={inv.total} c={c} /></span>
                  {state === 'partial' ? <StateBadge state={state} text={`${money(inv.total - paid, c)} due`} /> : <StateBadge state={state} />}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <Dock />
    </div>
  );
}
