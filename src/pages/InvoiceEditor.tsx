import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Field, Icon, Money, TopBar, useBusy } from '../components/ui';
import { invoicedDeliverableIds, projectSummary } from '../lib/calc';
import { addDays, currencySymbol, fmtHours, invoiceTypeLabel, money, nextNumber, num, round2, today } from '../lib/format';
import type { Deliverable, Invoice, InvoiceItem, InvoiceType, Project } from '../lib/types';

interface Line {
  key: number;
  title: string;
  detail: string;
  hourly: boolean;
  hours: string;
  rate: string;
  amount: string;
  deliverable_id: string | null;
}

let keySeq = 1;
const newLine = (p: Partial<Line> = {}): Line => ({
  key: keySeq++,
  title: '',
  detail: '',
  hourly: false,
  hours: '',
  rate: '',
  amount: '',
  deliverable_id: null,
  ...p,
});

const lineAmount = (l: Line) => (l.hourly ? round2(num(l.hours) * num(l.rate)) : round2(num(l.amount)));

function fromItem(it: InvoiceItem): Line {
  const hourly = it.hours != null && it.rate != null;
  return newLine({
    title: it.title,
    detail: hourly ? '' : it.detail ?? '',
    hourly,
    hours: hourly ? String(it.hours) : '',
    rate: hourly ? String(it.rate) : '',
    amount: String(it.amount),
    deliverable_id: it.deliverable_id ?? null,
  });
}

function fromDeliverable(d: Deliverable, p: Project): Line {
  const hourly = d.kind === 'hourly' && d.hours != null && d.rate != null;
  return newLine({
    title: d.title,
    detail: hourly ? '' : d.is_additional ? 'Additional work' : 'Fixed price',
    hourly,
    hours: hourly ? String(d.hours) : '',
    rate: hourly ? String(d.rate) : p.rates[0] ? String(p.rates[0].amount) : '',
    amount: String(d.amount),
    deliverable_id: d.id,
  });
}

const TYPES: InvoiceType[] = ['advance', 'milestone', 'additional', 'final', 'custom'];

export default function InvoiceEditor() {
  const { id, projectId } = useParams();
  const [params] = useSearchParams();
  const s = useStore();
  const existing = id ? s.invoices.find((i) => i.id === id) : undefined;
  const project = s.projects.find((p) => p.id === (existing?.project_id ?? projectId));
  if (!project || (id && !existing)) return <Navigate to="/" replace />;
  return <Editor key={existing?.id ?? `new-${project.id}-${params.get('type') ?? ''}`} project={project} existing={existing} initialType={params.get('type') as InvoiceType | null} />;
}

function Editor({ project, existing, initialType }: { project: Project; existing?: Invoice; initialType: InvoiceType | null }) {
  const s = useStore();
  const nav = useNavigate();
  const { busy, run } = useBusy();
  const c = project.currency;
  const sym = currencySymbol(c);

  const projectInvoices = s.invoices.filter((i) => i.project_id === project.id);
  const otherInvoices = projectInvoices.filter((i) => i.id !== existing?.id);
  const deliverables = s.deliverables.filter((d) => d.project_id === project.id);
  const summary = projectSummary(project, s.deliverables, otherInvoices, s.payments);
  const alreadyInvoiced = invoicedDeliverableIds(otherInvoices);
  const open = deliverables.filter((d) => !alreadyInvoiced.has(d.id));

  const defaultType: InvoiceType =
    initialType && TYPES.includes(initialType) ? initialType : otherInvoices.length === 0 ? 'advance' : 'milestone';

  const [type, setType] = useState<InvoiceType>(existing?.type ?? defaultType);
  const [pctVal, setPctVal] = useState('30');
  const build = (t: InvoiceType, p = pctVal): Line[] => {
    if (t === 'advance') {
      const v = round2((summary.value * num(p)) / 100);
      return [newLine({ title: 'Advance', detail: summary.value ? `${num(p)}% of project value (${money(summary.value, c)})` : '', amount: v ? String(v) : '' })];
    }
    if (t === 'milestone') {
      const done = open.filter((d) => d.status === 'done' && !d.is_additional);
      return done.length ? done.map((d) => fromDeliverable(d, project)) : [newLine({ title: 'Milestone payment' })];
    }
    if (t === 'additional') {
      const extra = open.filter((d) => d.is_additional);
      return extra.length ? extra.map((d) => fromDeliverable(d, project)) : [newLine({ hourly: project.rates.length > 0, rate: project.rates[0] ? String(project.rates[0].amount) : '' })];
    }
    if (t === 'final') {
      return [
        newLine({
          title: 'Final settlement',
          detail: summary.invoiced ? `Project value ${money(summary.value, c)} less ${money(summary.invoiced, c)} already invoiced` : 'Balance of project value',
          amount: summary.toInvoice ? String(summary.toInvoice) : '',
        }),
      ];
    }
    return [newLine()];
  };

  const [lines, setLines] = useState<Line[]>(() => (existing ? existing.items.map(fromItem) : build(defaultType)));
  const touched = useRef(false);
  const [issue, setIssue] = useState(existing?.issue_date ?? today());
  const [due, setDue] = useState(existing?.due_date ?? addDays(today(), s.settings.dueDays ?? 7));
  const [discount, setDiscount] = useState(existing?.discount ? String(existing.discount) : '');
  const [notes, setNotes] = useState(existing?.notes ?? s.settings.invoiceNote ?? '');

  const subtotal = round2(lines.reduce((t, l) => t + lineAmount(l), 0));
  const total = round2(subtotal - num(discount));

  const pickType = (t: InvoiceType) => {
    if (t === type) return;
    if (touched.current && !confirm('Switch type? This replaces the lines you entered.')) return;
    setType(t);
    setLines(build(t));
    touched.current = false;
  };
  const edit = (key: number, patch: Partial<Line>) => {
    touched.current = true;
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };
  const toggleDeliverable = (d: Deliverable) => {
    touched.current = true;
    setLines((ls) => {
      if (ls.some((l) => l.deliverable_id === d.id)) return ls.filter((l) => l.deliverable_id !== d.id);
      const blank = ls.filter((l) => !l.deliverable_id && !l.title && !num(l.amount));
      return [...ls.filter((l) => !blank.includes(l)), fromDeliverable(d, project)];
    });
  };
  const setAdvancePct = (p: string) => {
    setPctVal(p);
    setLines(build('advance', p));
  };

  const checklist = useMemo(() => {
    if (type === 'milestone') return open.filter((d) => !d.is_additional).concat(open.filter((d) => d.is_additional));
    if (type === 'additional') return open.filter((d) => d.is_additional);
    return [];
  }, [type, open]);

  const save = () =>
    run(async () => {
      const filled = lines.filter((l) => l.title.trim() || lineAmount(l));
      if (!filled.length) throw new Error('Add at least one line');
      if (filled.some((l) => !l.title.trim())) throw new Error('Every line needs a description');
      if (total <= 0) throw new Error('Total must be more than zero');

      // Additional-work lines that aren't in scope yet become deliverables, raising the project value.
      const items: InvoiceItem[] = [];
      for (const l of filled) {
        let did = l.deliverable_id;
        if (type === 'additional' && !did) {
          const d = await s.save('deliverables', {
            project_id: project.id,
            title: l.title.trim(),
            kind: l.hourly ? 'hourly' : 'fixed',
            hours: l.hourly ? num(l.hours) : null,
            rate: l.hourly ? num(l.rate) : null,
            amount: lineAmount(l),
            status: 'done',
            is_additional: true,
          });
          did = d.id;
          await s.log(project.id, 'scope', 'Additional work added', `${d.title} · ${money(d.amount, c)}`);
        }
        items.push({
          title: l.title.trim(),
          detail: l.hourly ? `${fmtHours(num(l.hours))} × ${money(num(l.rate), c)}` : l.detail.trim() || undefined,
          hours: l.hourly ? num(l.hours) : null,
          rate: l.hourly ? num(l.rate) : null,
          amount: lineAmount(l),
          deliverable_id: did,
        });
      }

      const row: Partial<Invoice> = {
        project_id: project.id,
        type,
        issue_date: issue,
        due_date: due || null,
        items,
        discount: round2(num(discount)),
        total,
        notes: notes.trim() || null,
      };
      if (existing) {
        await s.save('invoices', row, existing.id);
        nav(`/invoices/${existing.id}`, { replace: true });
      } else {
        const inv = await s.save('invoices', {
          ...row,
          number: nextNumber(s.settings.invoicePrefix || 'INV-', s.invoices.map((i) => i.number)),
          status: 'draft',
        });
        await s.log(project.id, 'invoice', 'Invoice created', `${inv.number} · ${invoiceTypeLabel[type]} · ${money(total, c)}`);
        nav(`/invoices/${inv.id}`, { replace: true });
      }
    });

  return (
    <div className="app" style={{ paddingBottom: 140 }}>
      <TopBar title={existing ? `Edit ${existing.number}` : 'New invoice'} />

      <div className="form-group">
        <div className="between">
          <h3>Type</h3>
          <span className="xs muted">{project.title} · {c}</span>
        </div>
        <div className="chips">
          {TYPES.map((t) => (
            <button key={t} className="chip" aria-pressed={type === t} onClick={() => pickType(t)}>
              {t === 'custom' ? 'Custom' : invoiceTypeLabel[t]}
            </button>
          ))}
        </div>

        {type === 'advance' && (
          <div className="stack">
            {summary.value > 0 ? (
              <>
                <div className="small muted">Percentage of the project value ({money(summary.value, c)})</div>
                <div className="chips">
                  {['25', '30', '40', '50'].map((p) => (
                    <button key={p} className="chip" aria-pressed={pctVal === p} onClick={() => setAdvancePct(p)}>
                      {p}%
                    </button>
                  ))}
                  <div className="input-affix" style={{ width: 96 }}>
                    <input className="input" style={{ minHeight: 36, padding: '6px 26px 6px 12px', fontSize: 14 }} inputMode="decimal" aria-label="Custom percentage" value={['25', '30', '40', '50'].includes(pctVal) ? '' : pctVal} placeholder="Other" onChange={(e) => setAdvancePct(e.target.value)} />
                    <b style={{ left: 'auto', right: 12 }}>%</b>
                  </div>
                </div>
              </>
            ) : (
              <div className="small muted">Add deliverables to the project to bill a percentage — or just type a fixed amount below.</div>
            )}
          </div>
        )}
        {type === 'final' && (
          <div className="small muted">
            Remaining balance: <span className="strong" style={{ color: 'var(--ink)' }}>{money(summary.toInvoice, c)}</span>
            {summary.value > 0 && ` (project value ${money(summary.value, c)} − already invoiced ${money(summary.invoiced, c)})`}
          </div>
        )}
        {type === 'additional' && <div className="small muted">New lines here are also added to the project scope as additional work.</div>}
        {checklist.length > 0 && (
          <div className="stack" style={{ gap: 0 }}>
            <div className="small muted" style={{ paddingBottom: 4 }}>Not yet invoiced — tap to include</div>
            {checklist.map((d) => (
              <label key={d.id} className="check" style={{ borderTop: '1px solid var(--line)' }}>
                <input type="checkbox" checked={lines.some((l) => l.deliverable_id === d.id)} onChange={() => toggleDeliverable(d)} />
                <span className="grow stack" style={{ gap: 1 }}>
                  <span className="strong" style={{ fontSize: 14 }}>{d.title}</span>
                  <span className="xs muted">{d.status === 'done' ? 'Done' : d.status === 'in_progress' ? 'In progress' : 'Not started'}{d.is_additional ? ' · Additional' : ''}</span>
                </span>
                <span className="small strong"><Money v={d.amount} c={c} /></span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="form-group">
        <h3>Lines</h3>
        {lines.map((l, i) => (
          <div key={l.key} className="line-edit">
            <div className="row" style={{ gap: 8 }}>
              <input className="input grow" placeholder="Description" aria-label={`Line ${i + 1} description`} value={l.title} onChange={(e) => edit(l.key, { title: e.target.value })} />
              <button className="icon-btn" aria-label="Remove line" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>
                <Icon name="close" size={16} />
              </button>
            </div>
            {l.hourly ? (
              <div className="row" style={{ gap: 8 }}>
                <input className="input" style={{ width: 90 }} inputMode="decimal" placeholder="Hours" aria-label="Hours" value={l.hours} onChange={(e) => edit(l.key, { hours: e.target.value })} />
                <span className="muted">×</span>
                <div className="input-affix grow">
                  <b>{sym}</b>
                  <input className="input" inputMode="decimal" placeholder="Rate" aria-label="Rate per hour" value={l.rate} onChange={(e) => edit(l.key, { rate: e.target.value })} />
                </div>
                <span className="strong small" style={{ minWidth: 80, textAlign: 'right' }}>{money(lineAmount(l), c)}</span>
              </div>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <input className="input grow" placeholder="Detail (optional)" aria-label="Detail" value={l.detail} onChange={(e) => edit(l.key, { detail: e.target.value })} />
                <div className="input-affix" style={{ width: 140 }}>
                  <b>{sym}</b>
                  <input className="input" inputMode="decimal" placeholder="0" aria-label="Amount" value={l.amount} onChange={(e) => edit(l.key, { amount: e.target.value })} />
                </div>
              </div>
            )}
            <button className="link-btn xs" style={{ alignSelf: 'flex-start', fontWeight: 500, color: 'var(--muted)' }} onClick={() => edit(l.key, l.hourly ? { hourly: false, amount: String(lineAmount(l) || '') } : { hourly: true, rate: l.rate || (project.rates[0] ? String(project.rates[0].amount) : '') })}>
              {l.hourly ? 'Use a fixed amount' : 'Bill as hours × rate'}
            </button>
          </div>
        ))}
        <button className="btn btn-tray" onClick={() => setLines([...lines, newLine()])}>
          <Icon name="plus" size={16} /> Add line
        </button>
        <div className="xs muted">Tip: to deduct an advance, add a line with a negative amount.</div>
      </div>

      <div className="form-group">
        <div className="grid2">
          <Field label="Issue date">
            <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" value={due ?? ''} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="Discount (optional)">
          <div className="input-affix">
            <b>{sym}</b>
            <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </div>
        </Field>
        <Field label="Note to client">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <div className="action-bar">
        <div style={{ alignItems: 'center' }}>
          <div className="stack grow" style={{ gap: 0 }}>
            <span className="xs muted">Total</span>
            <span className="amount-l num">{money(total, c)}</span>
          </div>
          <button className="btn btn-dark" style={{ flex: '0 0 auto', minWidth: 160 }} disabled={busy} onClick={save}>
            {busy ? 'Saving…' : existing ? 'Save changes' : 'Create invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
