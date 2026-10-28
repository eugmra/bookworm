import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { query } from '../db.js';

export const COOKIE_NAME = 'bw_session';

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionHours * 3600 * 1000,
  };
}

export function signSession(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: Math.round(config.sessionHours * 3600),
  });
}

/** Attaches req.user if a valid session cookie is present. Guests continue with req.user = null. */
export async function loadUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    const { rows } = await query('SELECT id, email, name, role, gift_points, wallet_paise FROM users WHERE id = $1', [
      Number(payload.sub),
    ]);
    req.user = rows[0] ?? null;
  } catch {
    req.user = null; // invalid/expired token: treat as guest
  }
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  next();
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (req.user.role !== role) return next(new AppError(403, 'Forbidden'));
    next();
  };
}

/**
 * CSRF defence in depth (cookies are already SameSite=Strict):
 * state-changing requests with an Origin header must come from an allowed origin or the same host.
 */
export function originCheck(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const sameHost = (() => {
    try {
      return new URL(origin).host === req.get('host');
    } catch {
      return false;
    }
  })();
  if (sameHost || config.allowedOrigins.includes(origin)) return next();
  next(new AppError(403, 'Origin not allowed'));
}
