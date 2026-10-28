import { Link } from 'react-router-dom';
import { formatDate, formatINRShort } from './format.js';

function wrapTitle(title, max = 11) {
  const lines = [];
  let line = '';
  for (const word of title.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

/** Generated book cover (no external images). Colours come from the book record. */
export function Cover({ book, size = 'md' }) {
  const { bg, fg, accent } = book.cover;
  const lines = wrapTitle(book.title.toUpperCase());
  const author = (book.author?.name ?? book.authorName ?? '').toUpperCase();
  return (
    <svg
      className={`cover cover-${size}`}
      viewBox="0 0 200 290"
      role="img"
      aria-label={`Cover of ${book.title}`}
    >
      <rect width="200" height="290" fill={bg} />
      <circle cx="165" cy="45" r="60" fill={accent} opacity="0.25" />
      <rect x="0" y="238" width="200" height="6" fill={accent} />
      {lines.map((l, i) => (
        <text key={i} x="100" y={70 + i * 30} textAnchor="middle" fontSize="24" fontWeight="800" fill={fg} fontFamily="Segoe UI, system-ui, sans-serif">
          {l}
        </text>
      ))}
      <text x="100" y="268" textAnchor="middle" fontSize="13" letterSpacing="2" fill={fg} fontFamily="Segoe UI, system-ui, sans-serif">
        {author.slice(0, 22)}
      </text>
    </svg>
  );
}

export function Stars({ value, label }) {
  const full = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={label ?? `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? 'on' : ''} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

export function BookMeta({ book }) {
  return (
    <>
      <p className="muted small">
        by <Link to={`/?author=${book.author.id}`}>{book.author.name}</Link>
      </p>
      <p className="small">{book.format}</p>
      <p className="small tags">
        <Link to={`/?category=${book.category.slug}`}>{book.category.name}</Link>
        <Link to={`/?brand=${book.brand.id}`}>{book.brand.name}</Link>
      </p>
    </>
  );
}

export function BookCard({ book, children }) {
  return (
    <article className="book-card">
      <Link to={`/book/${book.id}`} className="cover-link" aria-label={`View ${book.title}`}>
        <Cover book={book} />
      </Link>
      <div className="book-info">
        <h3>
          <Link to={`/book/${book.id}`}>{book.title}</Link>
        </h3>
        <BookMeta book={book} />
        <p className="price">{formatINRShort(book.pricePaise)}</p>
        <p className="muted small">
          {book.inStock ? (
            <>
              Delivery by <strong>{formatDate(book.deliveryDate)}</strong>
            </>
          ) : (
            'Out of stock'
          )}
        </p>
        {children}
      </div>
    </article>
  );
}

export function Message({ kind = 'error', children }) {
  if (!children) return null;
  return (
    <p className={`msg msg-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function Loading({ text = 'Loading…' }) {
  return (
    <p className="muted" role="status">
      {text}
    </p>
  );
}
