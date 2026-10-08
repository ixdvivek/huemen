import { useState } from 'react';
import { useStore } from '../lib/store';
import { Avatar, Empty, Field, Icon, Sheet, useBusy } from '../components/ui';
import { initials } from '../lib/format';
import type { Client } from '../lib/types';

export default function Clients() {
  const s = useStore();
  const [edit, setEdit] = useState<Client | 'new' | null>(null);
  const clients = s.clients.slice().sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  return (
    <div className="app">
      <div className="h-greet">Clients</div>
      {clients.length === 0 ? (
        <Empty>
          No clients yet. You can also add one while creating a project.
          <button className="btn btn-dark btn-sm" onClick={() => setEdit('new')}>
            <Icon name="plus" size={16} /> Add client
          </button>
        </Empty>
      ) : (
        <div className="list">
          {clients.map((c) => {
            const n = s.projects.filter((p) => p.client_id === c.id).length;
            return (
              <button key={c.id} className="list-row" onClick={() => setEdit(c)}>
                <Avatar text={initials(c.company || c.name)} seed={c.id} />
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="strong ellipsis" style={{ fontSize: 15 }}>{c.company || c.name}</span>
                  <span className="xs muted ellipsis">{[c.company ? c.name : null, c.email].filter(Boolean).join(' · ') || 'No contact details'}</span>
                </span>
                <span className="xs muted">{n} project{n === 1 ? '' : 's'}</span>
              </button>
            );
          })}
        </div>
      )}
      {edit && <ClientForm client={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const s = useStore();
  const { busy, run } = useBusy();
  const [f, setF] = useState({
    name: client?.name ?? '',
    company: client?.company ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    address: client?.address ?? '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = () =>
    run(async () => {
      if (!f.name.trim() && !f.company.trim()) throw new Error('Add a name or company');
      await s.save(
        'clients',
        {
          name: f.name.trim() || f.company.trim(),
          company: f.company.trim() || null,
          email: f.email.trim() || null,
          phone: f.phone.trim() || null,
          address: f.address.trim() || null,
        },
        client?.id,
      );
      onClose();
    });

  const del = () =>
    run(async () => {
      if (!client || !confirm(`Delete ${client.company || client.name}? Their projects stay, without a client.`)) return;
      await s.remove('clients', client.id);
      onClose();
    });

  return (
    <Sheet title={client ? 'Edit client' : 'New client'} onClose={onClose}>
      <div className="form-group">
        <Field label="Contact name">
          <input value={f.name} onChange={set('name')} autoFocus={!client} />
        </Field>
        <Field label="Company">
          <input value={f.company} onChange={set('company')} />
        </Field>
        <Field label="Email">
          <input type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Phone">
          <input type="tel" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Billing address" hint="Shown under “Billed to” on invoices.">
          <textarea value={f.address} onChange={set('address')} />
        </Field>
      </div>
      <div className="row">
        {client && (
          <button className="btn btn-danger" disabled={busy} onClick={del}>
            Delete
          </button>
        )}
        <button className="btn btn-dark grow" disabled={busy} onClick={submit}>
          {busy ? 'Saving…' : 'Save client'}
        </button>
      </div>
    </Sheet>
  );
}
