import { useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Seg, Sheet, useBusy, Money } from '../components/ui';
import { currencySymbol, money, num, round2 } from '../lib/format';
import type { Deliverable, DeliverableStatus, Project } from '../lib/types';

export default function DeliverableForm({ project, item, onClose }: { project: Project; item?: Deliverable; onClose: () => void }) {
  const s = useStore();
  const { busy, run } = useBusy();
  const [title, setTitle] = useState(item?.title ?? '');
  const [kind, setKind] = useState<'fixed' | 'hourly'>(item?.kind ?? 'fixed');
  const [amount, setAmount] = useState(item && item.kind === 'fixed' ? String(item.amount) : '');
  const [hours, setHours] = useState(item?.hours != null ? String(item.hours) : '');
  const [rate, setRate] = useState(item?.rate != null ? String(item.rate) : project.rates[0] ? String(project.rates[0].amount) : '');
  const [status, setStatus] = useState<DeliverableStatus>(item?.status ?? 'todo');
  const [additional, setAdditional] = useState(item?.is_additional ?? false);
  const [due, setDue] = useState(item?.due_date ?? '');

  const total = kind === 'hourly' ? round2(num(hours) * num(rate)) : num(amount);
  const sym = currencySymbol(project.currency);
  const invoiced = !!item && s.invoices.some((i) => i.status !== 'void' && i.items.some((it) => it.deliverable_id === item.id));

  const submit = () =>
    run(async () => {
      if (!title.trim()) throw new Error('Add a title');
      const saved = await s.save(
        'deliverables',
        {
          project_id: project.id,
          title: title.trim(),
          kind,
          hours: kind === 'hourly' ? num(hours) : null,
          rate: kind === 'hourly' ? num(rate) : null,
          amount: total,
          status,
          is_additional: additional,
          due_date: due || null,
        },
        item?.id,
      );
      if (!item && additional) await s.log(project.id, 'scope', 'Additional work added', `${saved.title} · ${money(saved.amount, project.currency)}`);
      else if (!item) await s.log(project.id, 'deliverable', 'Deliverable added', `${saved.title} · ${money(saved.amount, project.currency)}`);
      else if (item.status !== status && status === 'done') await s.log(project.id, 'deliverable', 'Deliverable completed', saved.title);
      onClose();
    });

  const del = () =>
    run(async () => {
      if (!item || !confirm(`Delete “${item.title}”?`)) return;
      await s.remove('deliverables', item.id);
      onClose();
    });

  return (
    <Sheet title={item ? 'Edit deliverable' : 'Add deliverable'} onClose={onClose}>
      <div className="form-group">
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="UI design · 8 pages" autoFocus={!item} />
        </Field>
        <div className="field">
          <span>Pricing</span>
          <Seg value={kind} onChange={setKind} options={[{ value: 'fixed', label: 'Fixed price' }, { value: 'hourly', label: 'Hours × rate' }]} />
        </div>
        {kind === 'fixed' ? (
          <Field label="Amount">
            <div className="input-affix">
              <b>{sym}</b>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
          </Field>
        ) : (
          <>
            <div className="grid2">
              <Field label="Hours">
                <input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Rate / hr">
                <div className="input-affix">
                  <b>{sym}</b>
                  <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                </div>
              </Field>
            </div>
            {project.rates.length > 0 && (
              <div className="chips">
                {project.rates.map((r) => (
                  <button key={r.name} className="chip" aria-pressed={num(rate) === r.amount} onClick={() => setRate(String(r.amount))}>
                    {r.name} · {money(r.amount, project.currency)}
                  </button>
                ))}
              </div>
            )}
            <div className="between small">
              <span className="muted">Total</span>
              <span className="strong"><Money v={total} c={project.currency} /></span>
            </div>
          </>
        )}
      </div>
      <div className="form-group">
        <div className="field">
          <span>Status</span>
          <Seg
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todo', label: 'Not started' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'done', label: 'Done' },
            ]}
          />
        </div>
        <Field label="Due date (optional)">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <label className="check" style={{ padding: 0 }}>
          <input type="checkbox" checked={additional} onChange={(e) => setAdditional(e.target.checked)} />
          <span>
            Additional work <span className="small muted">— outside the original scope</span>
          </span>
        </label>
        {invoiced && <div className="xs muted">Already on an invoice. Changing the amount here won't change that invoice.</div>}
      </div>
      <div className="row">
        {item && (
          <button className="btn btn-danger" disabled={busy} onClick={del}>
            Delete
          </button>
        )}
        <button className="btn btn-dark grow" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : item ? 'Save' : 'Add deliverable'}
        </button>
      </div>
    </Sheet>
  );
}
