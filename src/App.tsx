import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { backend } from './lib/db';
import { StoreProvider, useStore } from './lib/store';
import Login from './pages/Login';
import Home from './pages/Home';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import ProjectPage from './pages/ProjectPage';
import InvoiceEditor from './pages/InvoiceEditor';
import InvoiceView from './pages/InvoiceView';
import ReceiptView from './pages/ReceiptView';
import AppDock from './components/AppDock';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Toast() {
  const { toast } = useStore();
  return toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
}

function Shell() {
  const { loaded } = useStore();
  if (!loaded)
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/projects/:id" element={<ProjectPage />} />
        <Route path="/projects/:projectId/invoices/new" element={<InvoiceEditor />} />
        <Route path="/invoices/:id" element={<InvoiceView />} />
        <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
        <Route path="/receipts/:id" element={<ReceiptView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppDock />
      <Toast />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<{ email: string } | null | undefined>(undefined);

  useEffect(() => {
    // Only re-render when the signed-in account actually changes (token refreshes fire this too).
    const apply = (u: { email: string } | null) =>
      setUser((prev) => (prev && u && prev.email === u.email ? prev : u));
    backend.getSession().then(apply);
    // Defer: Supabase recommends not doing work inside the auth callback itself.
    return backend.onAuthChange((u) => setTimeout(() => apply(u), 0));
  }, []);

  if (user === undefined)
    return (
      <div className="center-screen">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  if (!user) return <Login />;

  return (
    <HashRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HashRouter>
  );
}
