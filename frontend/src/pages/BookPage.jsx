import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useFetch } from '../hooks.js';
import { Cover, Loading, Message, Stars, BookMeta } from '../components.jsx';
import { formatDate, formatDateTime, formatINRShort } from '../format.js';

function ReviewForm({ bookId, onSaved }) {
  const { user } = useApp();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!user) return navigate('/login', { state: { from: `/book/${bookId}` } });
    if (rating < 1) return setError('Please choose a star rating');
    if (!body.trim()) return setError('Please write a short review');
    setBusy(true);
    setError('');
    try {
      await api.review(bookId, rating, body.trim());
      setBody('');
      setRating(0);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="review-form">
      <label>
        <span className="small muted">
          Leave Your Review <span className="right">{body.length}/100</span>
        </span>
        <textarea value={body} maxLength={100} rows={4} placeholder="Write a short review" onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="review-actions">
        <div role="radiogroup" aria-label="Your rating" className="star-input">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              className={n <= rating ? 'on' : ''}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>
        <button className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Submit'}
        </button>
      </div>
      <Message>{error}</Message>
    </form>
  );
}

export default function BookPage() {
  const { id } = useParams();
  const { user, addItem, notify } = useApp();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(() => api.book(id), [id, user?.id]);
  const [wishBusy, setWishBusy] = useState(false);

  if (loading && !data) return <Loading />;
  if (error) return <Message>{error}</Message>;
  const { book, related, author, reviews, inWishlist } = data;

  const toggleWish = async () => {
    if (!user) return navigate('/login', { state: { from: `/book/${id}` } });
    setWishBusy(true);
    try {
      if (inWishlist) await api.removeWishlist(book.id);
      else await api.addWishlist(book.id);
      notify(inWishlist ? 'Removed from wishlist' : 'Added to wishlist');
      reload();
    } catch (err) {
      notify(err.message);
    } finally {
      setWishBusy(false);
    }
  };

  return (
    <div className="layout-2col product">
      <div className="content">
        <nav className="crumbs small" aria-label="Breadcrumb">
          <Link to="/">Home</Link> / <Link to={`/?category=${book.category.slug}`}>{book.category.name}</Link> / {book.title}
        </nav>

        <div className="product-main">
          <Cover book={book} size="lg" />
          <div className="product-back">
            <p className="small muted">“{book.tagline}”</p>
            <p className="small">{book.description}</p>
          </div>
          <div className="product-info">
            <h1>{book.title}</h1>
            <BookMeta book={book} />
            <p className="muted small">{book.tagline}</p>
            <p className="small">
              Published by <Link to={`/?brand=${book.brand.id}`}>{book.brand.name}</Link>
            </p>
            <p className="price big">{formatINRShort(book.pricePaise)}</p>
            <p className="muted small">
              {book.inStock ? (
                <>
                  Tentative delivery by <strong>{formatDate(book.deliveryDate)}</strong>
                </>
              ) : (
                'Currently out of stock'
              )}
            </p>
            <div className="actions">
              <button className="btn" disabled={!book.inStock} onClick={() => addItem(book.id)}>
                Add to Cart
              </button>
              <button className="btn btn-secondary" disabled={wishBusy} onClick={toggleWish}>
                {inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
              </button>
            </div>
            <dl className="facts">
              <div>
                <dt>Language</dt>
                <dd>{book.language}</dd>
              </div>
              <div>
                <dt>Rating</dt>
                <dd>
                  <Stars value={book.rating} /> <span className="small muted">({book.reviewCount})</span>
                </dd>
              </div>
              <div>
                <dt>Sales</dt>
                <dd>{book.copiesSold} copies sold</dd>
              </div>
            </dl>
          </div>
        </div>

        <section aria-label="About the writer">
          <h2 className="section-title">About the writer</h2>
          <p>
            <strong>{author.name}</strong>
          </p>
          <p className="small muted">{author.bio}</p>
        </section>

        <section aria-label="Reviews">
          <h2 className="section-title">Reviews</h2>
          <div className="reviews">
            <ReviewForm bookId={book.id} onSaved={reload} />
            <div>
              {reviews.length === 0 && <p className="muted small">No reviews yet. Be the first!</p>}
              {reviews.map((r) => (
                <div key={r.id} className="review">
                  <strong>{r.userName}</strong> <span className="muted small">{formatDateTime(r.createdAt)}</span>
                  <p className="small">{r.body}</p>
                  <Stars value={r.rating} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <aside className="related" aria-label="Related reads">
        <h2 className="section-title">Related Reads</h2>
        {related.map((r) => (
          <Link key={r.id} to={`/book/${r.id}`} className="related-item">
            <Cover book={r} size="sm" />
            <div>
              <strong>{r.title}</strong>
              <p className="small muted">by {r.author.name}</p>
              <p className="price">{formatINRShort(r.pricePaise)}</p>
              <p className="small muted">Delivery by {formatDate(r.deliveryDate)}</p>
            </div>
          </Link>
        ))}
      </aside>
    </div>
  );
}
