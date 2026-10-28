import { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useFetch } from '../hooks.js';
import { BookCard, Loading, Message } from '../components.jsx';

export default function Wishlist() {
  const { addItem } = useApp();
  const { data, error, loading, reload } = useFetch(() => api.wishlist(), []);
  const [msg, setMsg] = useState('');

  const remove = async (id) => {
    try {
      await api.removeWishlist(id);
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="page">
      <h1>My Wishlist</h1>
      <Message>{error || msg}</Message>
      {data?.books.length === 0 && <p className="muted">Your wishlist is empty.</p>}
      <div className="grid">
        {data?.books.map((b) => (
          <BookCard key={b.id} book={b}>
            <div className="actions">
              {b.inStock && (
                <button className="btn btn-small" onClick={() => addItem(b.id)}>
                  Add to Cart
                </button>
              )}
              <button className="btn btn-secondary btn-small" onClick={() => remove(b.id)}>
                Remove
              </button>
            </div>
          </BookCard>
        ))}
      </div>
    </div>
  );
}
