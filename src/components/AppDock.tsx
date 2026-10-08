import { useState } from 'react';
import { NavLink, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Avatar, Icon, Sheet } from './ui';
import { initials } from '../lib/format';
import ProjectForm from '../pages/ProjectForm';
import { ClientForm } from '../pages/Clients';

/** Routes where the bottom bar is hidden (full-screen creation / editing). */
const HIDE_ON = ['/projects/:projectId/invoices/new', '/invoices/:id/edit'];

export function useDockVisible() {
  const { pathname } = useLocation();
  return !HIDE_ON.some((p) => matchPath(p, pathname));
}

type Mode = null | 'menu' | 'pickProject' | 'project' | 'client';

export default function AppDock() {
  const s = useStore();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState<Mode>(null);
  const visible = useDockVisible();
  if (!visible) return null;

  // On a project (or one of its invoices/receipts) offer that project first.
  const projectId =
    matchPath('/projects/:id', pathname)?.params.id ??
    s.invoices.find((i) => i.id === matchPath('/invoices/:id', pathname)?.params.id)?.project_id ??
    s.payments.find((p) => p.id === matchPath('/receipts/:id', pathname)?.params.id)?.project_id;
  const current = s.projects.find((p) => p.id === projectId);

  const projects = s.projects
    .slice()
    .sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) || b.created_at.localeCompare(a.created_at));
  const close = () => setMode(null);
  const newInvoice = (id: string) => {
    close();
    nav(`/projects/${id}/invoices/new`);
  };

  return (
    <>
      <div className="dock">
        <div className="dock-inner">
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/projects') ? 'active' : '')}>
              Home
            </NavLink>
            <NavLink to="/clients">Clients</NavLink>
            <NavLink to="/invoices" className={({ isActive }) => (isActive || pathname.startsWith('/receipts') ? 'active' : '')}>
              Invoices
            </NavLink>
          </nav>
          <button className="fab" aria-label="Create new" aria-haspopup="dialog" onClick={() => setMode('menu')}>
            <Icon name="plus" size={22} stroke={2.2} />
          </button>
        </div>
      </div>

      {mode === 'menu' && (
        <Sheet title="Create" onClose={close}>
          <div className="list">
            {current && (
              <button className="list-row" onClick={() => newInvoice(current.id)}>
                <span className="avatar" style={{ background: 'var(--ink)', color: '#fff' }}><Icon name="doc" /></span>
                <span className="grow stack" style={{ gap: 2 }}>
                  <span className="strong" style={{ fontSize: 15 }}>Invoice for this project</span>
                  <span className="xs muted ellipsis">{current.title}</span>
                </span>
                <Icon name="chevron" size={16} />
              </button>
            )}
            <button className="list-row" onClick={() => (s.projects.length ? setMode('pickProject') : setMode('project'))}>
              <span className="avatar icon"><Icon name="doc" /></span>
              <span className="grow stack" style={{ gap: 2 }}>
                <span className="strong" style={{ fontSize: 15 }}>{current ? 'Invoice for another project' : 'New invoice'}</span>
                <span className="xs muted">{s.projects.length ? 'Pick a project to bill' : 'Create a project first'}</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <button className="list-row" onClick={() => setMode('project')}>
              <span className="avatar icon"><Icon name="folder" /></span>
              <span className="grow stack" style={{ gap: 2 }}>
                <span className="strong" style={{ fontSize: 15 }}>New project</span>
                <span className="xs muted">Client, rates and currency</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
            <button className="list-row" onClick={() => setMode('client')}>
              <span className="avatar icon"><Icon name="user" /></span>
              <span className="grow stack" style={{ gap: 2 }}>
                <span className="strong" style={{ fontSize: 15 }}>New client</span>
                <span className="xs muted">Contact and billing details</span>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          </div>
        </Sheet>
      )}

      {mode === 'pickProject' && (
        <Sheet title="Invoice which project?" onClose={close}>
          <div className="list">
            {projects.map((p) => {
              const c = s.clients.find((x) => x.id === p.client_id);
              return (
                <button key={p.id} className="list-row" onClick={() => newInvoice(p.id)}>
                  <Avatar text={initials(c?.company || c?.name || p.title)} seed={p.client_id ?? p.id} />
                  <span className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="strong ellipsis" style={{ fontSize: 15 }}>{p.title}</span>
                    <span className="xs muted ellipsis">
                      {c ? c.company || c.name : 'No client'} · {p.currency}
                      {p.status === 'completed' ? ' · Completed' : ''}
                    </span>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {mode === 'project' && <ProjectForm onClose={close} onSaved={(p) => nav(`/projects/${p.id}`)} />}
      {mode === 'client' && <ClientForm onClose={close} />}
    </>
  );
}
