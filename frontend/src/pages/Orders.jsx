import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useFetch } from '../hooks.js';
import { Loading, Message } from '../components.jsx';
import { METHOD_LABELS, formatDate, formatDateTime, formatINR } from '../format.js';

const STATUS = { PENDING_PAYMENT: 'Awaiting payment', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' };

export default function Orders() {
  const { addItem, refreshUser, notify } = useApp();
  const { data, error, loading, reload } = useFetch(() => api.orders(), []);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    setBusyId(id);
    setMsg('');
    try {
      await api.cancelOrder(id);
      await refreshUser();
      notify('Order cancelled');
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="page">
      <h1>My Orders</h1>
      <Message>{error || msg}</Message>
      {data?.orders.length === 0 && (
        <p className="muted">
          No orders yet. <Link to="/">Start shopping</Link>
        </p>
      )}
      {data?.orders.map((o) => (
        <article key={o.id} className="panel order">
          <header className="order-head">
            <div>
              <strong>Order #{o.id}</strong> <span className={`status status-${o.status}`}>{STATUS[o.status]}</span>
              <p className="small muted">Placed {formatDateTime(o.createdAt)}</p>
            </div>
            <div className="right">
              <strong>{formatINR(o.totalPaise)}</strong>
              {o.paymentMethod && <p className="small muted">{METHOD_LABELS[o.paymentMethod]}</p>}
            </div>
          </header>
          <ul className="order-items">
            {o.items.map((i) => (
              <li key={i.bookId}>
                <Link to={`/book/${i.bookId}`}>{i.title}</Link> × {i.quantity} <span className="muted small">by {i.authorName}</span>
                <button className="btn btn-small" onClick={() => addItem(i.bookId)}>
                  Buy it again
                </button>
              </li>
            ))}
          </ul>
          {o.status === 'CONFIRMED' && (
            <p className="small muted">
              Estimated delivery {formatDate(o.estimatedDelivery)}
              {o.canCancel && ` · Cancel until ${formatDateTime(o.cancellableUntil)}`}
            </p>
          )}
          <div className="order-actions">
            {o.status === 'PENDING_PAYMENT' && (
              <Link to={`/payment/${o.id}`} className="btn btn-small">
                Complete payment
              </Link>
            )}
            {o.canCancel && (
              <button className="btn btn-secondary btn-small" disabled={busyId === o.id} onClick={() => cancel(o.id)}>
                Cancel order
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
