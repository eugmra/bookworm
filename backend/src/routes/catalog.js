import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { estimatedDelivery } from '../lib/dates.js';

const router = Router();

const BOOK_SELECT = `
  SELECT b.id, b.title, b.tagline, b.description, b.format, b.language, b.kind,
         b.price_paise, b.stock, b.delivery_days, b.copies_sold, b.published_on,
         b.cover_bg, b.cover_fg, b.cover_accent,
         a.id AS author_id, a.name AS author_name,
         br.id AS brand_id, br.name AS brand_name,
         c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
         COALESCE(r.avg_rating, 0)::float AS rating, COALESCE(r.cnt, 0)::int AS review_count
  FROM books b
  JOIN authors a ON a.id = b.author_id
  JOIN brands br ON br.id = b.brand_id
  JOIN categories c ON c.id = b.category_id
  LEFT JOIN (SELECT book_id, AVG(rating) AS avg_rating, COUNT(*) AS cnt FROM reviews GROUP BY book_id) r
         ON r.book_id = b.id`;

export function mapBook(row) {
  return {
    id: row.id,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    format: row.format,
    language: row.language,
    kind: row.kind,
    pricePaise: row.price_paise,
    stock: row.stock,
    inStock: row.stock > 0,
    deliveryDate: estimatedDelivery(row.delivery_days),
    copiesSold: row.copies_sold,
    publishedOn: row.published_on,
    cover: { bg: row.cover_bg, fg: row.cover_fg, accent: row.cover_accent },
    author: { id: row.author_id, name: row.author_name },
    brand: { id: row.brand_id, name: row.brand_name },
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    rating: Math.round(row.rating * 10) / 10,
    reviewCount: row.review_count,
  };
}

export { BOOK_SELECT };

router.get('/categories', async (_req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.name, c.slug, COUNT(b.id)::int AS book_count
     FROM categories c LEFT JOIN books b ON b.category_id = c.id
     GROUP BY c.id ORDER BY c.sort_order, c.name`,
  );
  res.json({ categories: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, bookCount: r.book_count })) });
});

router.get('/brands', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const { rows } = await query(
    `SELECT br.id, br.name, COUNT(b.id)::int AS book_count
     FROM brands br
     JOIN books b ON b.brand_id = br.id
     JOIN categories c ON c.id = b.category_id
     WHERE ($1::text IS NULL OR c.slug = $1)
     GROUP BY br.id ORDER BY br.name`,
    [category],
  );
  res.json({ brands: rows.map((r) => ({ id: r.id, name: r.name, bookCount: r.book_count })) });
});

router.get('/filters', async (_req, res) => {
  const [langs, formats] = await Promise.all([
    query('SELECT DISTINCT language FROM books ORDER BY language'),
    query('SELECT DISTINCT format FROM books ORDER BY format'),
  ]);
  res.json({ languages: langs.rows.map((r) => r.language), formats: formats.rows.map((r) => r.format) });
});

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  brand: z.coerce.number().int().positive().optional(),
  author: z.coerce.number().int().positive().optional(),
  language: z.string().trim().max(40).optional(),
  format: z.enum(['Paperback', 'Hardcover', 'eBook']).optional(),
  minPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating']).default('relevance'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

const SORTS = {
  relevance: 'b.copies_sold DESC, b.id',
  price_asc: 'b.price_paise ASC, b.id',
  price_desc: 'b.price_paise DESC, b.id',
  newest: 'b.published_on DESC, b.id',
  rating: 'COALESCE(r.avg_rating, 0) DESC, b.copies_sold DESC, b.id',
};

router.get('/books', validate(listSchema, 'query'), async (req, res) => {
  const f = req.valid.query;
  const like = f.q ? `%${f.q.replace(/[\\%_]/g, '\\$&')}%` : null;
  const params = [
    like,
    f.category ?? null,
    f.brand ?? null,
    f.author ?? null,
    f.language ?? null,
    f.format ?? null,
    f.minPrice ?? null,
    f.maxPrice ?? null,
  ];
  const where = `WHERE ($1::text IS NULL OR b.title ILIKE $1 OR a.name ILIKE $1 OR br.name ILIKE $1)
      AND ($2::text IS NULL OR c.slug = $2)
      AND ($3::int IS NULL OR b.brand_id = $3)
      AND ($4::int IS NULL OR b.author_id = $4)
      AND ($5::text IS NULL OR b.language = $5)
      AND ($6::text IS NULL OR b.format = $6)
      AND ($7::int IS NULL OR b.price_paise >= $7)
      AND ($8::int IS NULL OR b.price_paise <= $8)`;
  const offset = (f.page - 1) * f.pageSize;
  // ORDER BY comes from an allow-list map, never from user text.
  const sql = `${BOOK_SELECT} ${where} ORDER BY ${SORTS[f.sort]} LIMIT $9 OFFSET $10`;
  const countSql = `SELECT COUNT(*)::int AS total FROM books b
      JOIN authors a ON a.id = b.author_id JOIN brands br ON br.id = b.brand_id JOIN categories c ON c.id = b.category_id ${where}`;
  const [list, count] = await Promise.all([query(sql, [...params, f.pageSize, offset]), query(countSql, params)]);
  res.json({ books: list.rows.map(mapBook), total: count.rows[0].total, page: f.page, pageSize: f.pageSize });
});

router.get('/books/bestsellers', async (_req, res) => {
  const { rows } = await query(`${BOOK_SELECT} ORDER BY b.copies_sold DESC, b.id LIMIT 6`);
  res.json({ books: rows.map(mapBook) });
});

router.get('/books/new', async (_req, res) => {
  const { rows } = await query(`${BOOK_SELECT} ORDER BY b.published_on DESC, b.id LIMIT 6`);
  res.json({ books: rows.map(mapBook) });
});

// Recommendations from order history: books in categories/by authors the customer bought before.
// Guests (or customers with no history) receive top rated books.
router.get('/books/recommended', async (req, res) => {
  let rows = [];
  if (req.user) {
    ({ rows } = await query(
      `${BOOK_SELECT}
       WHERE (b.category_id IN (SELECT bb.category_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
                                JOIN books bb ON bb.id = oi.book_id WHERE o.user_id = $1 AND o.status = 'CONFIRMED')
           OR b.author_id IN (SELECT bb.author_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
                              JOIN books bb ON bb.id = oi.book_id WHERE o.user_id = $1 AND o.status = 'CONFIRMED'))
         AND b.id NOT IN (SELECT oi.book_id FROM order_items oi JOIN orders o ON o.id = oi.order_id
                          WHERE o.user_id = $1 AND o.status = 'CONFIRMED')
       ORDER BY b.copies_sold DESC, b.id LIMIT 6`,
      [req.user.id],
    ));
  }
  if (rows.length === 0) {
    ({ rows } = await query(`${BOOK_SELECT} ORDER BY COALESCE(r.avg_rating, 0) DESC, b.copies_sold DESC, b.id LIMIT 6`));
  }
  res.json({ books: rows.map(mapBook), personalised: Boolean(req.user) });
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

router.get('/books/:id', validate(idParam, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const { rows } = await query(`${BOOK_SELECT} WHERE b.id = $1`, [id]);
  if (!rows[0]) throw new AppError(404, 'Book not found');
  const book = mapBook(rows[0]);

  const [related, authorInfo, reviews] = await Promise.all([
    query(
      `${BOOK_SELECT}
       WHERE b.id <> $1 AND (b.category_id = $2 OR b.author_id = $3)
       ORDER BY (b.author_id = $3) DESC, b.copies_sold DESC, b.id LIMIT 3`,
      [id, book.category.id, book.author.id],
    ),
    query('SELECT id, name, bio FROM authors WHERE id = $1', [book.author.id]),
    query(
      `SELECT r.id, r.rating, r.body, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.book_id = $1 ORDER BY r.created_at DESC LIMIT 50`,
      [id],
    ),
  ]);

  let inWishlist = false;
  if (req.user) {
    const w = await query('SELECT 1 FROM wishlist_items WHERE user_id = $1 AND book_id = $2', [req.user.id, id]);
    inWishlist = w.rowCount > 0;
  }

  res.json({
    book,
    inWishlist,
    related: related.rows.map(mapBook),
    author: authorInfo.rows[0],
    reviews: reviews.rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.created_at,
      userName: r.user_name,
    })),
  });
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(100),
});

router.post('/books/:id/reviews', requireAuth, validate(idParam, 'params'), validate(reviewSchema), async (req, res) => {
  const { id } = req.valid.params;
  const exists = await query('SELECT 1 FROM books WHERE id = $1', [id]);
  if (!exists.rowCount) throw new AppError(404, 'Book not found');
  await query(
    `INSERT INTO reviews (book_id, user_id, rating, body) VALUES ($1, $2, $3, $4)
     ON CONFLICT (book_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, created_at = now()`,
    [id, req.user.id, req.valid.body.rating, req.valid.body.body],
  );
  res.status(201).json({ ok: true });
});

export default router;
