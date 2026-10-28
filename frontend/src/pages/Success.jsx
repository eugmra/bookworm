import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useFetch } from '../hooks.js';
import { Cover, Loading, Message } from '../components.jsx';
import { formatDate, formatDateTime, formatINR, formatINRShort } from '../format.js';

export default function Success() {
  const { id } = useParams();
  const { data, error, loading } = useFetch(() => api.order(id), [id]);
  if (loading) return <Loading />;
  if (error) return <Message>{error}</Message>;
  const o = data.order;
  if (o.status !== 'CONFIRMED') return <Message kind="info">This order is not confirmed.</Message>;

  return (
    <div className="pay-wrap">
      <section className="success-modal" aria-label="Purchase confirmation">
        <div className="tick" aria-hidden="true">✓</div>
        <h1>Your purchase of the following reads is successful</h1>
        <p className="small muted">
          Order #{o.id} · Paid {formatINR(o.totalPaise)} · Estimated delivery {formatDate(o.estimatedDelivery)}
        </p>
        <div className="success-items">
          {o.items.map((i) => (
            <div key={i.bookId} className="cart-line">
              <Cover book={{ title: i.title, cover: i.cover, authorName: i.authorName }} size="sm" />
              <div>
                <h3>{i.title}</h3>
                <p className="small muted">by {i.authorName}</p>
                <p className="small">{i.format}</p>
                <p className="price">{formatINRShort(i.unitPricePaise)}</p>
                <p className="small muted">Delivery by {formatDate(o.estimatedDelivery)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="small muted">
          You can cancel this order until {formatDateTime(o.cancellableUntil)} from <Link to="/orders">My Orders</Link>.
          {o.pointsEarned > 0 && ` You earned ${o.pointsEarned} gift points.`}
        </p>
        <Link to="/" className="btn">
          Continue your Shopping
        </Link>
      </section>
    </div>
  );
}
