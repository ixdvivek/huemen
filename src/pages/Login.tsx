import { useState, type FormEvent } from 'react';
import { backend } from '../lib/db';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await backend.signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : err?.message ?? 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="center-screen">
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }} className="stack-lg">
        <div className="stack" style={{ gap: 4 }}>
          <div className="h-greet">Welcome back.</div>
          <div className="h-greet faint">Sign in to your studio.</div>
        </div>
        <div className="form-group">
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && (
            <div className="small" style={{ color: 'var(--red-ink)' }} role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-dark btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}
