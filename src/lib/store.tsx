import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend } from './db';
import { defaultSettings, type Activity, type Settings, type Snapshot, type TableName, type Tables } from './types';

const CACHE_KEY = 'huemen-cache-v1';

const empty: Snapshot = {
  settings: defaultSettings,
  clients: [],
  projects: [],
  deliverables: [],
  invoices: [],
  payments: [],
  activity: [],
};

function readCache(): Snapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

interface Store extends Snapshot {
  loaded: boolean;
  syncing: boolean;
  offline: boolean;
  hideAmounts: boolean;
  toggleHide(): void;
  toast: string | null;
  notify(msg: string): void;
  refresh(): Promise<void>;
  save<K extends TableName>(table: K, data: Partial<Tables[K]>, id?: string): Promise<Tables[K]>;
  remove(table: TableName, id: string): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  log(projectId: string | null, kind: Activity['kind'], title: string, detail?: string): Promise<void>;
  clearCache(): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const cached = useRef(readCache());
  const [data, setData] = useState<Snapshot>(cached.current ?? empty);
  const [loaded, setLoaded] = useState(!!cached.current);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hideAmounts, setHide] = useState(() => {
    try {
      return localStorage.getItem('huemen-hide') === '1';
    } catch {
      return false;
    }
  });
  const toastTimer = useRef<number>(0);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // persist a copy for instant start + offline viewing
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  }, [data, loaded]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const snap = await backend.loadAll();
      setData(snap);
      setLoaded(true);
      setOffline(false);
    } catch (e) {
      setOffline(true);
      if (!cached.current) notify('Could not load data. Check your connection.');
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }, [notify]);

  useEffect(() => {
    refresh();
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', refresh);
    };
  }, [refresh]);

  const save = useCallback(async <K extends TableName>(table: K, row: Partial<Tables[K]>, id?: string) => {
    const saved = id ? await backend.update(table, id, row) : await backend.insert(table, row);
    setData((d) => {
      const list = d[table] as Tables[K][];
      const exists = list.some((r) => r.id === saved.id);
      return { ...d, [table]: exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved] };
    });
    return saved;
  }, []);

  const remove = useCallback(async (table: TableName, id: string) => {
    await backend.remove(table, id);
    setData((d) => {
      const next: any = { ...d, [table]: (d[table] as any[]).filter((r) => r.id !== id) };
      if (table === 'projects')
        for (const t of ['deliverables', 'invoices', 'payments', 'activity'] as const)
          next[t] = (d[t] as any[]).filter((r) => r.project_id !== id);
      if (table === 'invoices') next.payments = d.payments.filter((p) => p.invoice_id !== id);
      if (table === 'clients') next.projects = d.projects.map((p) => (p.client_id === id ? { ...p, client_id: null } : p));
      return next;
    });
  }, []);

  const saveSettings = useCallback(async (s: Settings) => {
    await backend.saveSettings(s);
    setData((d) => ({ ...d, settings: s }));
  }, []);

  const log = useCallback(
    async (projectId: string | null, kind: Activity['kind'], title: string, detail?: string) => {
      try {
        await save('activity', { project_id: projectId, kind, title, detail: detail ?? null });
      } catch (e) {
        console.warn('activity log failed', e);
      }
    },
    [save],
  );

  const value = useMemo<Store>(
    () => ({
      ...data,
      loaded,
      syncing,
      offline,
      hideAmounts,
      toggleHide: () =>
        setHide((h) => {
          try {
            localStorage.setItem('huemen-hide', h ? '0' : '1');
          } catch {}
          return !h;
        }),
      toast,
      notify,
      refresh,
      save,
      remove,
      saveSettings,
      log,
      clearCache: () => {
        try {
          localStorage.removeItem(CACHE_KEY);
        } catch {}
      },
    }),
    [data, loaded, syncing, offline, hideAmounts, toast, notify, refresh, save, remove, saveSettings, log],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
