import { z } from 'zod';
import { AppError } from '../errors.js';
import { computeTotals } from '../lib/pricing.js';
import { estimatedDelivery } from '../lib/dates.js';

export const cartItemsSchema = z
  .array(
    z.object({
      bookId: z.number().int().positive(),
      quantity: z.number().int().min(1).max(10),
    }),
  )
  .min(1, 'Cart is empty')
  .max(50);

export async function getStore(db) {
  const { rows } = await db.query('SELECT * FROM stores WHERE id = 1');
  if (!rows[0]) throw new AppError(500, 'Store is not configured');
  return rows[0];
}

/**
 * Merge duplicate book ids, then load current price/stock from the DB.
 * Prices always come from the database, never from the client.
 * Pass lock=true inside a transaction to lock the book rows (FOR UPDATE).
 */
export async function loadLines(db, items, { lock = false } = {}) {
  const merged = new Map();
  for (const { bookId, quantity } of items) {
    merged.set(bookId, Math.min(10, (merged.get(bookId) ?? 0) + quantity));
  }
  const ids = [...merged.keys()].sort((a, b) => a - b); // stable lock order avoids deadlocks
  const { rows } = await db.query(
    `SELECT b.id, b.title, b.price_paise, b.stock, b.delivery_days, b.format, b.cover_bg, b.cover_fg, b.cover_accent,
            a.name AS author_name
     FROM books b JOIN authors a ON a.id = b.author_id
     WHERE b.id = ANY($1::int[]) ORDER BY b.id ${lock ? 'FOR UPDATE OF b' : ''}`,
    [ids],
  );
  if (rows.length !== ids.length) throw new AppError(400, 'One or more books no longer exist');
  return rows.map((r) => {
    const quantity = merged.get(r.id);
    if (r.stock < quantity) throw new AppError(409, `Not enough stock for "${r.title}"`, 'OUT_OF_STOCK');
    return {
      bookId: r.id,
      title: r.title,
      authorName: r.author_name,
      format: r.format,
      quantity,
      unitPricePaise: r.price_paise,
      deliveryDays: r.delivery_days,
      cover: { bg: r.cover_bg, fg: r.cover_fg, accent: r.cover_accent },
    };
  });
}

export async function findCoupon(db, code) {
  if (!code) return null;
  const { rows } = await db.query('SELECT * FROM coupons WHERE code = $1', [code.trim().toUpperCase()]);
  return rows[0] ?? null;
}

export function latestDeliveryDate(lines, now = new Date()) {
  const days = Math.max(...lines.map((l) => l.deliveryDays));
  return estimatedDelivery(days, now);
}

/** Builds a priced quote. Throws 400 for a coupon that does not exist / does not apply. */
export async function buildQuote(db, { items, couponCode, pointsToUse = 0, user }, opts = {}) {
  // Sequential on purpose: `db` may be one transaction client, which cannot run queries concurrently.
  const store = await getStore(db);
  const lines = await loadLines(db, items, opts);
  const coupon = await findCoupon(db, couponCode);
  if (couponCode && !coupon) throw new AppError(400, 'Invalid coupon code', 'INVALID_COUPON');

  const totals = computeTotals({
    items: lines,
    store,
    coupon,
    pointsRequested: user ? pointsToUse : 0,
    pointsAvailable: user ? user.gift_points : 0,
  });
  if (coupon && totals.couponOffPaise === 0) {
    throw new AppError(400, 'Coupon is expired or the minimum order value is not met', 'INVALID_COUPON');
  }
  return { store, lines, coupon, totals, deliveryDate: latestDeliveryDate(lines) };
}

export function quoteResponse({ lines, coupon, totals, deliveryDate }) {
  return {
    lines,
    couponCode: coupon?.code ?? null,
    deliveryDate,
    ...totals,
  };
}
