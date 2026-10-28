import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../AppContext.jsx';
import { useFetch } from '../hooks.js';
import { BookCard, Loading, Message } from '../components.jsx';
import { PRICE_RANGES } from '../format.js';

function Section({ title, books }) {
  if (!books?.length) return null;
  return (
    <section aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <div className="grid">
        {books.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const { user, addItem } = useApp();
  const [params, setParams] = useSearchParams();

  const f = {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    brand: params.get('brand') ?? '',
    author: params.get('author') ?? '',
    language: params.get('language') ?? '',
    format: params.get('format') ?? '',
    price: params.get('price') ?? '0',
    sort: params.get('sort') ?? 'relevance',
  };
  const filtering = Boolean(f.q || f.category || f.brand || f.author || f.language || f.format || f.price !== '0' || f.sort !== 'relevance');

  const set = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value == null || (key === 'price' && value === '0')) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const cats = useFetch(() => api.categories(), []);
  const filterOpts = useFetch(() => api.filters(), []);
  const brands = useFetch(() => api.brands(f.category || undefined), [f.category]);

  const range = PRICE_RANGES[Number(f.price)] ?? PRICE_RANGES[0];
  const list = useFetch(
    () =>
      filtering
        ? api.books({
            q: f.q, category: f.category, brand: f.brand, author: f.author, language: f.language,
            format: f.format, minPrice: range.min, maxPrice: range.max, sort: f.sort, pageSize: 48,
          })
        : Promise.resolve(null),
    [filtering, f.q, f.category, f.brand, f.author, f.language, f.format, f.price, f.sort],
  );
  const recommended = useFetch(() => (filtering ? Promise.resolve(null) : api.recommended()), [filtering, user?.id]);
  const bestsellers = useFetch(() => (filtering ? Promise.resolve(null) : api.bestsellers()), [filtering]);
  const fresh = useFetch(() => (filtering ? Promise.resolve(null) : api.newBooks()), [filtering]);
  const history = useFetch(() => (user && !filtering ? api.orders() : Promise.resolve(null)), [user?.id, filtering]);

  const bought = useMemo(() => {
    const seen = new Map();
    for (const o of history.data?.orders ?? []) {
      if (o.status !== 'CONFIRMED') continue;
      for (const i of o.items) if (!seen.has(i.bookId)) seen.set(i.bookId, i);
    }
    return [...seen.values()].slice(0, 4);
  }, [history.data]);

  const activeCategory = cats.data?.categories.find((c) => c.slug === f.category);

  return (
    <div className="layout-2col">
      <aside className="sidebar" aria-label="Categories">
        <ul>
          <li>
            <button className={!f.category ? 'side-item active' : 'side-item'} onClick={() => set('category', '')}>
              All
            </button>
          </li>
          {cats.data?.categories.map((c) => (
            <li key={c.id}>
              <button className={f.category === c.slug ? 'side-item active' : 'side-item'} onClick={() => set('category', c.slug)}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="content">
        <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
          <label>
            <span className="small muted">Search your next read here</span>
            <input type="search" value={f.q} maxLength={100} placeholder="Title, writer or publisher" onChange={(e) => set('q', e.target.value)} />
          </label>
          <label>
            <span className="small muted">Language</span>
            <select value={f.language} onChange={(e) => set('language', e.target.value)}>
              <option value="">All</option>
              {filterOpts.data?.languages.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="small muted">Format (Paperback, eBook etc)</span>
            <select value={f.format} onChange={(e) => set('format', e.target.value)}>
              <option value="">All</option>
              {filterOpts.data?.formats.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="small muted">Price range</span>
            <select value={f.price} onChange={(e) => set('price', e.target.value)}>
              {PRICE_RANGES.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="small muted">Sort by</span>
            <select value={f.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="newest">Newest</option>
              <option value="rating">Top rated</option>
            </select>
          </label>
        </form>

        {(brands.data?.brands.length ?? 0) > 0 && (
          <div className="brand-row" aria-label="Brands">
            <span className="small muted">Brands:</span>
            <button className={!f.brand ? 'chip active' : 'chip'} onClick={() => set('brand', '')}>
              All
            </button>
            {brands.data.brands.map((b) => (
              <button key={b.id} className={String(b.id) === f.brand ? 'chip active' : 'chip'} onClick={() => set('brand', String(b.id))}>
                {b.name}
              </button>
            ))}
          </div>
        )}

        {filtering ? (
          <section aria-label="Results">
            <h2 className="section-title">
              {activeCategory ? activeCategory.name : 'Results'}
              {list.data ? <span className="muted small"> · {list.data.total} books</span> : null}
            </h2>
            {list.loading && <Loading />}
            <Message>{list.error}</Message>
            {list.data && list.data.books.length === 0 && <p className="muted">No books match these filters.</p>}
            <div className="grid">
              {list.data?.books.map((b) => (
                <BookCard key={b.id} book={b}>
                  {b.inStock && (
                    <button className="btn btn-small" onClick={() => addItem(b.id)}>
                      Add to Cart
                    </button>
                  )}
                </BookCard>
              ))}
            </div>
          </section>
        ) : (
          <>
            {bought.length > 0 && (
              <section aria-label="Buy it again">
                <h2 className="section-title">Buy it again</h2>
                <div className="row-cards">
                  {bought.map((i) => (
                    <div key={i.bookId} className="mini-card">
                      <Link to={`/book/${i.bookId}`}>{i.title}</Link>
                      <button className="btn btn-small" onClick={() => addItem(i.bookId)}>
                        Buy it again
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <Message>{recommended.error || bestsellers.error || fresh.error}</Message>
            {recommended.loading && <Loading />}
            <Section title={user ? 'Recommended for You' : 'Recommended for You'} books={recommended.data?.books} />
            <Section title="Bestsellers this Month" books={bestsellers.data?.books} />
            <Section title="New Launches" books={fresh.data?.books} />
          </>
        )}
      </div>
    </div>
  );
}
