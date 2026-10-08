import { createClient, type Session } from '@supabase/supabase-js';
import { DEMO, SUPABASE_KEY, SUPABASE_URL } from '../config';
import { defaultSettings, type Settings, type Snapshot, type TableName, type Tables } from './types';
import { demoSnapshot } from './demo';

export interface Backend {
  getSession(): Promise<{ email: string } | null>;
  onAuthChange(cb: (s: { email: string } | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<Snapshot>;
  insert<K extends TableName>(table: K, row: Partial<Tables[K]>): Promise<Tables[K]>;
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<Tables[K]>;
  remove(table: TableName, id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
}

const NUMERIC: Record<string, string[]> = {
  deliverables: ['hours', 'rate', 'amount'],
  invoices: ['discount', 'total'],
  payments: ['amount'],
};

function normalize<T>(table: string, row: any): T {
  for (const k of NUMERIC[table] ?? []) if (row[k] != null) row[k] = Number(row[k]);
  return row as T;
}

/* ---------------- Supabase ---------------- */

function supabaseBackend(): Backend {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const toUser = (s: Session | null) => (s?.user ? { email: s.user.email ?? '' } : null);
  const check = <T>(res: { data: T; error: any }): T => {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  };

  return {
    async getSession() {
      const { data } = await sb.auth.getSession();
      return toUser(data.session);
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(toUser(s)));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async loadAll() {
      const tables: TableName[] = ['clients', 'projects', 'deliverables', 'invoices', 'payments', 'activity'];
      const [settingsRes, ...rest] = await Promise.all([
        sb.from('settings').select('data').maybeSingle(),
        ...tables.map((t) =>
          sb.from(t).select('*').order('created_at', { ascending: true }).limit(t === 'activity' ? 2000 : 10000),
        ),
      ]);
      const settingsRow = check(settingsRes as any) as { data: Partial<Settings> } | null;
      const out: any = { settings: { ...defaultSettings, ...(settingsRow?.data ?? {}) } };
      tables.forEach((t, i) => {
        out[t] = (check(rest[i] as any) as any[]).map((r) => normalize(t, r));
      });
      return out as Snapshot;
    },
    async insert(table, row) {
      const data = check(await sb.from(table).insert(row as any).select().single());
      return normalize(table, data);
    },
    async update(table, id, patch) {
      const data = check(await sb.from(table).update(patch as any).eq('id', id).select().single());
      return normalize(table, data);
    },
    async remove(table, id) {
      check(await sb.from(table).delete().eq('id', id));
    },
    async saveSettings(s) {
      check(await sb.from('settings').upsert({ data: s, updated_at: new Date().toISOString() }));
    },
  };
}

/* ---------------- Demo (this browser only) ---------------- */

function demoBackend(): Backend {
  const KEY = 'huemen-demo-db';
  const read = (): Snapshot => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const seed = demoSnapshot();
    write(seed);
    return seed;
  };
  const write = (s: Snapshot) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  };
  const user = { email: 'demo@huemen.app' };
  return {
    async getSession() {
      return user;
    },
    onAuthChange() {
      return () => {};
    },
    async signIn() {},
    async signOut() {
      localStorage.removeItem(KEY);
      location.reload();
    },
    async loadAll() {
      return read();
    },
    async insert(table, row) {
      const db = read();
      const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row } as any;
      (db[table] as any[]).push(full);
      write(db);
      return full;
    },
    async update(table, id, patch) {
      const db = read();
      const list = db[table] as any[];
      const i = list.findIndex((r) => r.id === id);
      list[i] = { ...list[i], ...patch };
      write(db);
      return list[i];
    },
    async remove(table, id) {
      const db = read();
      (db as any)[table] = (db[table] as any[]).filter((r) => r.id !== id);
      // mimic cascades
      if (table === 'projects') {
        for (const t of ['deliverables', 'invoices', 'payments', 'activity'] as const)
          (db as any)[t] = (db[t] as any[]).filter((r) => r.project_id !== id);
      }
      if (table === 'invoices') db.payments = db.payments.filter((p) => p.invoice_id !== id);
      if (table === 'clients') db.projects.forEach((p) => p.client_id === id && (p.client_id = null));
      write(db);
    },
    async saveSettings(s) {
      const db = read();
      db.settings = s;
      write(db);
    },
  };
}

export const backend: Backend = DEMO ? demoBackend() : supabaseBackend();
