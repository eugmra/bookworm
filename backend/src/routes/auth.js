import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import { COOKIE_NAME, cookieOptions, signSession, requireAuth } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  giftPoints: u.gift_points,
  walletPaise: u.wallet_paise,
});

// Precomputed hash so login timing does not reveal whether an email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/register', authLimiter, validate(registerSchema), async (req, res) => {
  const { name, email, password } = req.valid.body;
  const hash = await bcrypt.hash(password, 12);
  // Unique violation (23505) is mapped to 409 by the error handler.
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, name, email, role, gift_points, wallet_paise`,
    [name, email, hash],
  );
  res.cookie(COOKIE_NAME, signSession(rows[0]), cookieOptions());
  res.status(201).json({ user: publicUser(rows[0]) });
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const { rows } = await query(
    'SELECT id, name, email, role, gift_points, wallet_paise, password_hash FROM users WHERE lower(email) = $1',
    [email],
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');
  res.cookie(COOKIE_NAME, signSession(user), cookieOptions());
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.get('/me/summary', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
