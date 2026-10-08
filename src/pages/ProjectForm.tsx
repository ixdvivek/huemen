import { useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Icon, Seg, Sheet, useBusy } from '../components/ui';
import { currencySymbol, num, today } from '../lib/format';
import type { Currency, Project, ProjectStatus, Rate } from '../lib/types';

export default function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project?: Project;
  onClose: () => void;
  onSaved?: (p: Project) => void;
}) {
  const s = useStore();
  const { busy, run } = useBusy();
  const [title, setTitle] = useState(project?.title ?? '');
  const [clientId, setClientId] = useState<string>(project?.client_id ?? (s.clients.length ? '' : 'new'));
  const [newClient, setNewClient] = useState({ name: '', company: '', email: '' });
  const [currency, setCurrency] = useState<Currency>(project?.currency ?? 'INR');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active');
  const [rates, setRates] = useState<{ name: string; amount: string }[]>(
    project?.rates.length ? project.rates.map((r) => ({ name: r.name, amount: String(r.amount) })) : [{ name: 'Hourly rate', amount: '' }],
  );
  const [startDate, setStartDate] = useState(project?.start_date ?? today());
  const [notes, setNotes] = useState(project?.notes ?? '');

  const hasInvoices = !!project && s.invoices.some((i) => i.project_id === project.id);

  const submit = () =>
    run(async () => {
      if (!title.trim()) throw new Error('Give the project a name');
      let cid: string | null = clientId || null;
      if (clientId === 'new') {
        if (!newClient.name.trim() && !newClient.company.trim()) {
          cid = null;
        } else {
          const c = await s.save('clients', {
            name: newClient.name.trim() || newClient.company.trim(),
            company: newClient.company.trim() || null,
            email: newClient.email.trim() || null,
          });
          cid = c.id;
        }
      }
      const cleanRates: Rate[] = rates.filter((r) => r.name.trim() && num(r.amount) > 0).map((r) => ({ name: r.name.trim(), amount: num(r.amount) }));
      const saved = await s.save(
        'projects',
        { title: title.trim(), client_id: cid, currency, status, rates: cleanRates, start_date: startDate || null, notes: notes.trim() || null },
        project?.id,
      );
      if (!project) await s.log(saved.id, 'project', 'Project created', saved.title);
      else if (project.status !== status) await s.log(saved.id, 'status', 'Status changed', `${project.status.replace('_', ' ')} → ${status.replace('_', ' ')}`);
      onClose();
      onSaved?.(saved);
    });

  return (
    <Sheet title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <div className="form-group">
        <Field label="Project name">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Website redesign" autoFocus={!project} />
        </Field>
        <Field label="Client">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client</option>
            {s.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company ? `${c.company} · ${c.name}` : c.name}
              </option>
            ))}
            <option value="new">+ New client…</option>
          </select>
        </Field>
        {clientId === 'new' && (
          <div className="line-edit">
            <input className="input" placeholder="Contact name" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
            <input className="input" placeholder="Company (optional)" value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })} />
            <input className="input" type="email" placeholder="Email (optional)" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
            <div className="xs muted">Add address and phone later under Clients.</div>
          </div>
        )}
        <div className="field">
          <span>Currency</span>
          {hasInvoices ? (
            <div className="small muted">{currency} — locked because this project already has invoices.</div>
          ) : (
            <Seg value={currency} onChange={setCurrency} options={[{ value: 'INR', label: '₹ INR' }, { value: 'USD', label: '$ USD' }]} />
          )}
        </div>
        {project && (
          <div className="field">
            <span>Status</span>
            <Seg
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'on_hold', label: 'On hold' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <div className="between">
          <h3 style={{ margin: 0, fontSize: 15 }}>Hourly rates</h3>
          <button className="btn btn-tray btn-sm" onClick={() => setRates([...rates, { name: '', amount: '' }])}>
            <Icon name="plus" size={14} /> Add rate
          </button>
        </div>
        {rates.map((r, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <input className="input grow" placeholder="e.g. Design" value={r.name} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Rate name" />
            <div className="input-affix" style={{ width: 130 }}>
              <b>{currencySymbol(currency)}</b>
              <input className="input" inputMode="decimal" placeholder="/hr" value={r.amount} onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} aria-label="Rate per hour" />
            </div>
            <button className="icon-btn tray-bg" aria-label="Remove rate" onClick={() => setRates(rates.filter((_, j) => j !== i))}>
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <div className="xs muted">Used for hourly deliverables and invoice lines. Optional.</div>
      </div>

      <div className="form-group">
        <Field label="Start date">
          <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Notes" hint="Private — never shown on invoices.">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      <button className="btn btn-dark btn-block" disabled={busy} onClick={submit}>
        {busy ? 'Saving…' : project ? 'Save changes' : 'Create project'}
      </button>
    </Sheet>
  );
}
