import { useState } from 'react';
import { useStore } from '../lib/store';
import { backend } from '../lib/db';
import { Field, TopBar, useBusy } from '../components/ui';
import { initials, num, today } from '../lib/format';
import type { Settings as S } from '../lib/types';

async function resizeImage(file: File, size = 256): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Settings() {
  const s = useStore();
  const { busy, run } = useBusy();
  const [f, setF] = useState<S>(s.settings);
  const set = (k: keyof S) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const save = () => run(() => s.saveSettings({ ...f, dueDays: Math.max(0, Math.round(num(f.dueDays))) }), 'Settings saved');

  const exportBackup = () => {
    const data = {
      exported_at: new Date().toISOString(),
      settings: s.settings,
      clients: s.clients,
      projects: s.projects,
      deliverables: s.deliverables,
      invoices: s.invoices,
      payments: s.payments,
      activity: s.activity,
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `huemen-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="app">
      <TopBar title="Settings" back="/" />

      <div className="form-group">
        <h3>Your business</h3>
        <div className="row">
          <div className="avatar lg" style={{ background: 'var(--ink)', color: '#fff', overflow: 'hidden' }}>
            {f.logo ? <img src={f.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(f.businessName || 'My Studio')}
          </div>
          <label className="btn btn-tray btn-sm" style={{ cursor: 'pointer' }}>
            {f.logo ? 'Change logo' : 'Upload logo'}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setF({ ...f, logo: await resizeImage(file) });
              }}
            />
          </label>
          {f.logo && (
            <button className="link-btn small" onClick={() => setF({ ...f, logo: '' })}>
              Remove
            </button>
          )}
        </div>
        <Field label="Business name" hint="Top of every invoice and receipt.">
          <input value={f.businessName} onChange={set('businessName')} placeholder="Your Studio" />
        </Field>
        <Field label="Your name">
          <input value={f.ownerName} onChange={set('ownerName')} />
        </Field>
        <div className="grid2">
          <Field label="Email">
            <input type="email" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Phone">
            <input type="tel" value={f.phone} onChange={set('phone')} />
          </Field>
        </div>
        <Field label="Address / city">
          <textarea value={f.address} onChange={set('address')} style={{ minHeight: 64 }} />
        </Field>
      </div>

      <div className="form-group">
        <h3>Getting paid in INR</h3>
        <Field label="UPI ID" hint="INR invoices get a scan-to-pay QR with the exact amount.">
          <input value={f.upiId} onChange={set('upiId')} placeholder="yourname@okhdfcbank" autoCapitalize="off" />
        </Field>
        <Field label="Name on UPI">
          <input value={f.upiName} onChange={set('upiName')} placeholder="As registered with your bank" />
        </Field>
        <Field label="Bank name">
          <input value={f.bankName} onChange={set('bankName')} />
        </Field>
        <Field label="Account holder">
          <input value={f.accountName} onChange={set('accountName')} />
        </Field>
        <div className="grid2">
          <Field label="Account number">
            <input inputMode="numeric" value={f.accountNumber} onChange={set('accountNumber')} />
          </Field>
          <Field label="IFSC">
            <input value={f.ifsc} onChange={set('ifsc')} autoCapitalize="characters" />
          </Field>
        </div>
      </div>

      <div className="form-group">
        <h3>Getting paid in USD</h3>
        <Field label="Payment instructions" hint="Shown on USD invoices — Wise, PayPal, wire / SWIFT details.">
          <textarea value={f.usdDetails} onChange={set('usdDetails')} placeholder={'Wise: you@email.com\nSWIFT: …'} />
        </Field>
      </div>

      <div className="form-group">
        <h3>Invoices & receipts</h3>
        <div className="grid2">
          <Field label="Invoice prefix">
            <input value={f.invoicePrefix} onChange={set('invoicePrefix')} />
          </Field>
          <Field label="Receipt prefix">
            <input value={f.receiptPrefix} onChange={set('receiptPrefix')} />
          </Field>
        </div>
        <Field label="Payment due after (days)">
          <input inputMode="numeric" value={String(f.dueDays)} onChange={set('dueDays')} />
        </Field>
        <Field label="Default invoice note">
          <textarea value={f.invoiceNote} onChange={set('invoiceNote')} style={{ minHeight: 64 }} />
        </Field>
        <Field label="Receipt thank-you line">
          <input value={f.receiptNote} onChange={set('receiptNote')} />
        </Field>
      </div>

      <button className="btn btn-dark btn-block" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>

      <div className="form-group">
        <h3>Data</h3>
        <div className="small muted row" style={{ gap: 8 }}>
          <span className={'sync-dot' + (s.offline ? ' off' : '')} />
          {s.offline ? 'Offline — changes need a connection.' : 'Synced to the cloud. Same data on every device you sign in on.'}
        </div>
        <button className="btn btn-tray" onClick={exportBackup}>Download backup (JSON)</button>
        <button
          className="btn btn-light"
          style={{ border: '1.5px solid var(--line-2)' }}
          onClick={async () => {
            s.clearCache();
            await backend.signOut();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
