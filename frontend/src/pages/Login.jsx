import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { Message } from '../components.jsx';

export default function Login() {
  const { setUser } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/';

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = mode === 'login' ? await api.login(email, password) : await api.register(name, email, password);
      setUser(r.user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page narrow">
      <form className="panel" onSubmit={submit}>
        <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        {mode === 'register' && (
          <label>
            Name
            <input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={mode === 'register' ? 12 : 1}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === 'register' && <p className="small muted">Use at least 12 characters.</p>}
        <Message>{error}</Message>
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
        <p className="small">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <p className="small muted">You can browse and build a basket as a guest. Signing in is needed to pay.</p>
      </form>
    </div>
  );
}
