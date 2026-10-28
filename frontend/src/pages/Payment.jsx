import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useFetch } from '../hooks.js';
import { Loading, Message } from '../components.jsx';
import { formatINR } from '../format.js';

const TABS = [
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit card' },
  { id: 'upi', label: 'UPI' },
  { id: 'wallet', label: 'Wallet' },
];

export default function Payment() {
  const { id } = useParams();
  const { user, refreshUser } = useApp();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch(() => api.order(id), [id]);
  const [method, setMethod] = useState('credit_card');
  const [f, setF] = useState({ cardNumber: '', nameOnCard: '', cvv: '', expiry: '', upiId: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) return <Message>{error}</Message>;
  const order = data.order;
  if (order.status !== 'PENDING_PAYMENT') {
    return <Message kind="info">This order is not awaiting payment.</Message>;
  }
  const free = order.totalPaise === 0;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setBusy(true);
    try {
      const details = method === 'upi' ? { upiId: f.upiId } : method === 'wallet' ? undefined : f;
      await api.pay(order.id, { method: free ? 'wallet' : method, details: free ? undefined : details });
      await refreshUser();
      navigate(`/success/${order.id}`, { replace: true });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelOrder(order.id);
      navigate('/orders');
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="pay-wrap">
      <form className="pay-modal" onSubmit={submit}>
        <div className="pay-head">
          <h1>Complete Payment</h1>
          <strong>Payable Amount: {formatINR(order.totalPaise)}</strong>
        </div>
        <div className="pay-body">
          <div className="pay-tabs" role="tablist" aria-label="Payment method">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={method === t.id}
                className={method === t.id ? 'active' : ''}
                onClick={() => setMethod(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="pay-fields">
            {free && <p className="small">Your gift points and coupon cover this order. No payment needed.</p>}
            {!free && (method === 'credit_card' || method === 'debit_card') && (
              <div className="form-grid">
                <label>Card Number<input required inputMode="numeric" autoComplete="cc-number" maxLength={23} placeholder="XXXX-XXXX-XXXX-XXXX" value={f.cardNumber} onChange={set('cardNumber')} /></label>
                <label>Name on Card<input required autoComplete="cc-name" maxLength={80} placeholder="Name" value={f.nameOnCard} onChange={set('nameOnCard')} /></label>
                <label>CVV<input required type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} pattern="\d{3,4}" placeholder="XXX" value={f.cvv} onChange={set('cvv')} /></label>
                <label>Date of Expiry<input required autoComplete="cc-exp" maxLength={7} pattern="(0[1-9]|1[0-2])/\d{4}" placeholder="MM/YYYY" value={f.expiry} onChange={set('expiry')} /></label>
              </div>
            )}
            {!free && method === 'upi' && (
              <label>UPI ID<input required maxLength={100} placeholder="name@bank" value={f.upiId} onChange={set('upiId')} /></label>
            )}
            {!free && method === 'wallet' && (
              <p className="small">
                Wallet balance: <strong>{formatINR(user?.walletPaise ?? 0)}</strong>
              </p>
            )}
            <Message>{msg}</Message>
            <div className="pay-actions">
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>
                Cancel order
              </button>
              <button className="btn" disabled={busy}>
                {busy ? 'Processing…' : free ? 'Confirm' : 'Pay Now'}
              </button>
            </div>
            {!free && method !== 'upi' && method !== 'wallet' && (
              <p className="small muted">Demo gateway: use 4242 4242 4242 4242 to succeed; a card ending 0002 is declined.</p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
