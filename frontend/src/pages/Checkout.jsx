import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { Cover, Loading, Message } from '../components.jsx';
import { formatDate, formatINR, formatINRShort } from '../format.js';

const EMPTY_ADDR = {
  firstName: '', lastName: '', line1: '', city: '', pin: '', state: '', country: 'India', email: '', phone: '',
};

export default function Checkout() {
  const { user, cart, changeQty, clearCart } = useApp();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [usePoints, setUsePoints] = useState(false);

  const [saved, setSaved] = useState([]);
  const [useSaved, setUseSaved] = useState(false);
  const [addressId, setAddressId] = useState('');
  const [addr, setAddr] = useState(EMPTY_ADDR);
  const [saveAddress, setSaveAddress] = useState(false);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const pointsToUse = usePoints && user ? user.giftPoints : 0;
  const cartKey = useMemo(() => JSON.stringify(cart), [cart]);

  useEffect(() => {
    if (!user) return;
    api
      .addresses()
      .then((r) => setSaved(r.addresses))
      .catch(() => setSaved([]));
  }, [user]);

  useEffect(() => {
    if (cart.length === 0) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    api
      .quote({ items: cart, couponCode: coupon || undefined, pointsToUse })
      .then((r) => {
        if (cancelled) return;
        setQuote(r.quote);
        setQuoteError('');
        setCouponError('');
      })
      .catch((err) => {
        if (cancelled) return;
        if (coupon && /coupon/i.test(err.message)) {
          setCouponError(err.message);
          setCoupon('');
        } else {
          setQuoteError(err.message);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, coupon, pointsToUse]);

  const setField = (k) => (e) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  const payNow = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!user) return navigate('/login', { state: { from: '/checkout' } });
    if (useSaved && !addressId) return setFormError('Choose a saved address');
    setBusy(true);
    try {
      const payload = { items: cart, couponCode: coupon || undefined, pointsToUse };
      if (useSaved) payload.addressId = Number(addressId);
      else {
        payload.address = addr;
        payload.saveAddress = saveAddress;
      }
      const { order } = await api.createOrder(payload);
      clearCart();
      navigate(`/payment/${order.id}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="page">
        <h1>Shopping Cart</h1>
        <p className="muted">Your basket is empty.</p>
        <Link to="/" className="btn">
          Browse books
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Shopping Cart</h1>
      <Message>{quoteError}</Message>
      {!quote && loading && <Loading />}

      {quote && (
        <>
          <section className="panel cart-lines" aria-label="Basket">
            {quote.lines.map((l) => (
              <div key={l.bookId} className="cart-line">
                <Cover book={{ title: l.title, cover: l.cover, authorName: l.authorName }} size="sm" />
                <div className="grow">
                  <h3>
                    <Link to={`/book/${l.bookId}`}>{l.title}</Link>
                  </h3>
                  <p className="small muted">by {l.authorName}</p>
                  <p className="small">{l.format}</p>
                  <p className="price">{formatINRShort(l.unitPricePaise)}</p>
                  <p className="small muted">Delivery by {formatDate(quote.deliveryDate)}</p>
                  <div className="qty" role="group" aria-label={`Quantity for ${l.title}`}>
                    <button type="button" aria-label="Decrease quantity" onClick={() => changeQty(l.bookId, l.quantity - 1)}>
                      −
                    </button>
                    <span aria-live="polite">{l.quantity}</span>
                    <button type="button" aria-label="Increase quantity" onClick={() => changeQty(l.bookId, l.quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <form className="checkout-grid" onSubmit={payNow}>
            <section className="panel" aria-label="Delivery address">
              <h2>Address</h2>
              {user && saved.length > 0 && (
                <>
                  <label className="check">
                    <input type="checkbox" checked={useSaved} onChange={(e) => setUseSaved(e.target.checked)} /> Use Saved Address
                  </label>
                  {useSaved && (
                    <select value={addressId} onChange={(e) => setAddressId(e.target.value)} aria-label="Saved address">
                      <option value="">Select an address</option>
                      {saved.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.firstName} {a.lastName}, {a.line1}, {a.city} {a.pin}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
              {!useSaved && (
                <div className="form-grid">
                  <label>First Name<input required maxLength={60} value={addr.firstName} onChange={setField('firstName')} autoComplete="given-name" /></label>
                  <label>Last Name<input required maxLength={60} value={addr.lastName} onChange={setField('lastName')} autoComplete="family-name" /></label>
                  <label className="span2">Address<input required minLength={3} maxLength={200} value={addr.line1} onChange={setField('line1')} autoComplete="address-line1" placeholder="Address Line" /></label>
                  <label>e-mail<input required type="email" maxLength={254} value={addr.email} onChange={setField('email')} autoComplete="email" /></label>
                  <label>City<input required maxLength={80} value={addr.city} onChange={setField('city')} autoComplete="address-level2" /></label>
                  <label>Pin<input required pattern="[0-9A-Za-z -]{3,10}" maxLength={10} value={addr.pin} onChange={setField('pin')} autoComplete="postal-code" placeholder="000000" /></label>
                  <label>Phone Number<input required type="tel" pattern="\+?[0-9 \-]{7,18}" maxLength={18} value={addr.phone} onChange={setField('phone')} autoComplete="tel" placeholder="+91 1234567890" /></label>
                  <label>State<input required maxLength={80} value={addr.state} onChange={setField('state')} autoComplete="address-level1" /></label>
                  <label>Country<input required maxLength={80} value={addr.country} onChange={setField('country')} autoComplete="country-name" /></label>
                </div>
              )}
              {user && !useSaved && (
                <label className="check">
                  <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address
                </label>
              )}
            </section>

            <section className="panel" aria-label="Grand total">
              <h2>Grand Total</h2>
              <dl className="totals">
                <div><dt>Price ({quote.lines.reduce((n, l) => n + l.quantity, 0)} items)</dt><dd>{formatINR(quote.subtotalPaise)}</dd></div>
                {quote.couponOffPaise > 0 && <div><dt>Coupon {quote.couponCode}</dt><dd>− {formatINR(quote.couponOffPaise)}</dd></div>}
                <div><dt>Tax</dt><dd>{formatINR(quote.taxPaise)}</dd></div>
                <div><dt>Delivery Charges</dt><dd>{quote.deliveryPaise === 0 ? 'Free' : formatINR(quote.deliveryPaise)}</dd></div>
                {quote.pointsUsed > 0 && <div><dt>Gift points ({quote.pointsUsed})</dt><dd>− {formatINR(quote.pointsOffPaise)}</dd></div>}
                <div className="total"><dt>Total Amount</dt><dd>{formatINR(quote.totalPaise)}</dd></div>
              </dl>

              <div className="coupon">
                <input
                  value={couponInput}
                  maxLength={40}
                  placeholder="Apply Coupon"
                  aria-label="Coupon code"
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <button type="button" className="btn btn-small" onClick={() => setCoupon(couponInput.trim().toUpperCase())}>
                  Apply
                </button>
              </div>
              <Message>{couponError}</Message>

              {user && user.giftPoints > 0 && (
                <label className="check">
                  <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} /> Redeem gift points ({user.giftPoints} available)
                </label>
              )}
              {quote.pointsEarned > 0 && <p className="small muted">You will earn {quote.pointsEarned} gift points.</p>}

              <Message>{formError}</Message>
              <button className="btn btn-block" disabled={busy || loading}>
                {busy ? 'Please wait…' : user ? 'Pay Now' : 'Sign in to pay'}
              </button>
            </section>
          </form>
        </>
      )}
    </div>
  );
}
