import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { BOOK_SELECT, mapBook } from './catalog.js';

const router = Router();
router.use(requireAuth);

const idParam = z.object({ id: z.coerce.number().int().positive() });

// ---------- Wishlist ----------
router.get('/wishlist', async (req, res) => {
  const { rows } = await query(
    `${BOOK_SELECT} JOIN wishlist_items w ON w.book_id = b.id AND w.user_id = $1 ORDER BY w.created_at DESC`,
    [req.user.id],
  );
  res.json({ books: rows.map(mapBook) });
});

router.put('/wishlist/:id', validate(idParam, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const exists = await query('SELECT 1 FROM books WHERE id = $1', [id]);
  if (!exists.rowCount) throw new AppError(404, 'Book not found');
  await query('INSERT INTO wishlist_items (user_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
  res.status(204).end();
});

router.delete('/wishlist/:id', validate(idParam, 'params'), async (req, res) => {
  await query('DELETE FROM wishlist_items WHERE user_id = $1 AND book_id = $2', [req.user.id, req.valid.params.id]);
  res.status(204).end();
});

// ---------- Writers (followed authors) ----------
router.get('/writers', async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.name, a.bio,
            (SELECT COUNT(*)::int FROM books b WHERE b.author_id = a.id) AS book_count,
            (f.user_id IS NOT NULL) AS followed
     FROM authors a LEFT JOIN author_follows f ON f.author_id = a.id AND f.user_id = $1
     ORDER BY (f.user_id IS NOT NULL) DESC, a.name`,
    [req.user.id],
  );
  res.json({
    writers: rows.map((r) => ({ id: r.id, name: r.name, bio: r.bio, bookCount: r.book_count, followed: r.followed })),
  });
});

router.put('/writers/:id/follow', validate(idParam, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const exists = await query('SELECT 1 FROM authors WHERE id = $1', [id]);
  if (!exists.rowCount) throw new AppError(404, 'Writer not found');
  await query('INSERT INTO author_follows (user_id, author_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, id]);
  res.status(204).end();
});

router.delete('/writers/:id/follow', validate(idParam, 'params'), async (req, res) => {
  await query('DELETE FROM author_follows WHERE user_id = $1 AND author_id = $2', [req.user.id, req.valid.params.id]);
  res.status(204).end();
});

// ---------- Addresses ----------
const mapAddress = (a) => ({
  id: a.id,
  firstName: a.first_name,
  lastName: a.last_name,
  line1: a.line1,
  city: a.city,
  pin: a.pin,
  state: a.state,
  country: a.country,
  email: a.email,
  phone: a.phone,
});

router.get('/addresses', async (req, res) => {
  const { rows } = await query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [req.user.id]);
  res.json({ addresses: rows.map(mapAddress) });
});

router.delete('/addresses/:id', validate(idParam, 'params'), async (req, res) => {
  await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.valid.params.id, req.user.id]);
  res.status(204).end();
});

export default router;
