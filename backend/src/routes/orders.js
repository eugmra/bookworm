import { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db.js';
import { AppError } from '../errors.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { buildQuote, cartItemsSchema, getStore, quoteResponse } from '../services/checkout.js';
import { chargeGateway, validatePaymentDetails } from '../lib/payments.js';
import { cancelDeadline } from '../lib/dates.js';
import { logger } from '../logger.js';

const router = Router();

const idParam = z.object({ id: z.coerce.number().int().positive() });

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  line1: z.string().trim().min(3).max(200),
  city: z.string().trim().min(1).max(80),
  pin: z.string().trim().regex(/^[0-9A-Za-z -]{3,10}$/, 'Invalid PIN / postal code'),
  state: z.string().trim().min(1).max(80),
  country: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9 -]{7,18}$/, 'Invalid phone number'),
});

const quoteSchema = z.object({
  items: cartItemsSchema,
  couponCode: z.string().trim().max(40).optional(),
  pointsToUse: z.number().int().min(0).max(10_000_000).default(0),
});

router.post('/checkout/quote', validate(quoteSchema), async (req, res) => {
  const { items, couponCode, pointsToUse } = req.valid.body;
  const q = await buildQuote({ query }, { items, couponCode, pointsToUse, user: req.user });
  res.json({ quote: quoteResponse(q), giftPoints: req.user?.gift_points ?? 0 });
});

const createSchema = quoteSchema.extend({
  addressId: z.number().int().positive().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().default(false),
});

router.post('/orders', requireAuth, validate(createSchema), async (req, res) => {
  const { items, couponCode, pointsToUse, addressId, address, saveAddress } = req.valid.body;
  const userId = req.user.id;

  const orderId = await withTx(async (db) => {
    let ship = address;
    if (addressId) {
      const { rows } = await db.query(
        `SELECT first_name, last_name, line1, city, pin, state, country, email, phone
         FROM addresses WHERE id = $1 AND user_id = $2`,
        [addressId, userId],
      );
      if (!rows[0]) throw new AppError(404, 'Saved address not found');
      const a = rows[0];
      ship = {
        firstName: a.first_name, lastName: a.last_name, line1: a.line1, city: a.city,
        pin: a.pin, state: a.state, country: a.country, email: a.email, phone: a.phone,
      };
    }
    if (!ship) throw new AppError(400, 'A delivery address is required');

    // Lock the user row so concurrent checkouts see a consistent points balance.
    const u = await db.query('SELECT gift_points FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const q = await buildQuote(db, { items, couponCode, pointsToUse, user: { gift_points: u.rows[0].gift_points } });

    const { rows } = await db.query(
      `INSERT INTO orders (user_id, subtotal_paise, tax_paise, delivery_paise, coupon_code, coupon_off_paise,
                           points_used, points_off_paise, total_paise, points_earned, ship_address, estimated_delivery)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [
        userId, q.totals.subtotalPaise, q.totals.taxPaise, q.totals.deliveryPaise, q.coupon?.code ?? null,
        q.totals.couponOffPaise, q.totals.pointsUsed, q.totals.pointsOffPaise, q.totals.totalPaise,
        q.totals.pointsEarned, JSON.stringify(ship), q.deliveryDate,
      ],
    );
    const newId = rows[0].id;
    for (const l of q.lines) {
      await db.query(
        'INSERT INTO order_items (order_id, book_id, quantity, unit_price_paise) VALUES ($1,$2,$3,$4)',
        [newId, l.bookId, l.quantity, l.unitPricePaise],
      );
    }
    if (saveAddress && !addressId) {
      await db.query(
        `INSERT INTO addresses (user_id, first_name, last_name, line1, city, pin, state, country, email, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [userId, ship.firstName, ship.lastName, ship.line1, ship.city, ship.pin, ship.state, ship.country, ship.email, ship.phone],
      );
    }
    return newId;
  });

  res.status(201).json({ order: await loadOrder(orderId, userId) });
});

const paySchema = z.object({
  method: z.enum(['credit_card', 'debit_card', 'upi', 'wallet']),
  details: z
    .object({
      cardNumber: z.string().max(25).optional(),
      nameOnCard: z.string().max(80).optional(),
      cvv: z.string().max(4).optional(),
      expiry: z.string().max(7).optional(),
      upiId: z.string().max(100).optional(),
    })
    .optional(),
});

router.post('/orders/:id/pay', requireAuth, validate(idParam, 'params'), validate(paySchema), async (req, res) => {
  const { id } = req.valid.params;
  const { method, details } = req.valid.body;
  const userId = req.user.id;
  const store = await getStore({ query });

  await withTx(async (db) => {
    const o = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
    const order = o.rows[0];
    if (!order) throw new AppError(404, 'Order not found');
    if (order.status !== 'PENDING_PAYMENT') throw new AppError(409, 'Order is not awaiting payment');

    const items = (await db.query('SELECT book_id, quantity FROM order_items WHERE order_id = $1 ORDER BY book_id', [id])).rows;
    const books = (
      await db.query('SELECT id, title, stock FROM books WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [
        items.map((i) => i.book_id),
      ])
    ).rows;
    const stockById = new Map(books.map((b) => [b.id, b]));
    for (const it of items) {
      const b = stockById.get(it.book_id);
      if (!b || b.stock < it.quantity) {
        throw new AppError(409, `Not enough stock for "${b?.title ?? 'a book'}"`, 'OUT_OF_STOCK');
      }
    }

    const user = (await db.query('SELECT gift_points, wallet_paise FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
    if (user.gift_points < order.points_used) {
      throw new AppError(409, 'Gift points balance changed, please review your order');
    }

    const payAmount = order.total_paise;
    let usedMethod = method;
    let reference;
    let last4 = null;
    let walletDebit = 0;

    if (payAmount === 0) {
      usedMethod = 'gift_points';
      reference = `SIM-GIFT-${id}`;
    } else if (method === 'wallet') {
      if (user.wallet_paise < payAmount) throw new AppError(402, 'Insufficient wallet balance', 'INSUFFICIENT_WALLET');
      walletDebit = payAmount;
      reference = chargeGateway('wallet', {}).reference;
    } else {
      const validated = validatePaymentDetails(method, details ?? {});
      last4 = validated.last4 ?? null;
      try {
        reference = chargeGateway(method, validated).reference;
      } catch (err) {
        logger.warn('Payment declined', { orderId: id, method });
        throw err;
      }
    }

    const paidAt = new Date();
    await db.query(
      'UPDATE users SET gift_points = gift_points - $2 + $3, wallet_paise = wallet_paise - $4 WHERE id = $1',
      [userId, order.points_used, order.points_earned, walletDebit],
    );
    for (const it of items) {
      await db.query('UPDATE books SET stock = stock - $2, copies_sold = copies_sold + $2 WHERE id = $1', [it.book_id, it.quantity]);
    }
    await db.query(
      `INSERT INTO payments (order_id, method, amount_paise, status, reference, card_last4)
       VALUES ($1,$2,$3,'SUCCESS',$4,$5)`,
      [id, usedMethod, payAmount, reference, last4],
    );
    await db.query(
      `UPDATE orders SET status = 'CONFIRMED', payment_method = $2, paid_at = $3, cancellable_until = $4 WHERE id = $1`,
      [id, usedMethod, paidAt, cancelDeadline(paidAt, store.cancel_window_hours)],
    );
    logger.info('Order confirmed', { orderId: id, method: usedMethod });
  });

  res.json({ order: await loadOrder(id, userId) });
});

router.post('/orders/:id/cancel', requireAuth, validate(idParam, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const userId = req.user.id;

  await withTx(async (db) => {
    const o = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, userId]);
    const order = o.rows[0];
    if (!order) throw new AppError(404, 'Order not found');

    if (order.status === 'PENDING_PAYMENT') {
      await db.query(`UPDATE orders SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`, [id]);
      return;
    }
    if (order.status !== 'CONFIRMED') throw new AppError(409, 'Order is already cancelled');
    if (new Date(order.cancellable_until) < new Date()) {
      throw new AppError(409, 'The cancellation window for this order has closed', 'CANCEL_WINDOW_CLOSED');
    }

    const items = (await db.query('SELECT book_id, quantity FROM order_items WHERE order_id = $1 ORDER BY book_id', [id])).rows;
    await db.query('SELECT id FROM books WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [items.map((i) => i.book_id)]);
    for (const it of items) {
      await db.query(
        'UPDATE books SET stock = stock + $2, copies_sold = GREATEST(copies_sold - $2, 0) WHERE id = $1',
        [it.book_id, it.quantity],
      );
    }

    const pay = (
      await db.query(`SELECT method, amount_paise FROM payments WHERE order_id = $1 AND status = 'SUCCESS' LIMIT 1`, [id])
    ).rows[0];
    const walletRefund = pay?.method === 'wallet' ? pay.amount_paise : 0;
    // Return redeemed points; take back earned points (never below zero).
    await db.query(
      `UPDATE users SET gift_points = GREATEST(gift_points + $2 - $3, 0), wallet_paise = wallet_paise + $4 WHERE id = $1`,
      [userId, order.points_used, order.points_earned, walletRefund],
    );
    if (pay && pay.amount_paise > 0) {
      await db.query(
        `INSERT INTO payments (order_id, method, amount_paise, status, reference) VALUES ($1,$2,$3,'REFUNDED',$4)`,
        [id, pay.method, pay.amount_paise, `SIM-REFUND-${id}`],
      );
    }
    await db.query(`UPDATE orders SET status = 'CANCELLED', cancelled_at = now() WHERE id = $1`, [id]);
    logger.info('Order cancelled', { orderId: id });
  });

  res.json({ order: await loadOrder(id, userId) });
});

function mapOrder(o, items) {
  return {
    id: o.id,
    status: o.status,
    subtotalPaise: o.subtotal_paise,
    taxPaise: o.tax_paise,
    deliveryPaise: o.delivery_paise,
    couponCode: o.coupon_code,
    couponOffPaise: o.coupon_off_paise,
    pointsUsed: o.points_used,
    pointsOffPaise: o.points_off_paise,
    totalPaise: o.total_paise,
    pointsEarned: o.points_earned,
    shipAddress: o.ship_address,
    paymentMethod: o.payment_method,
    estimatedDelivery: o.estimated_delivery,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    cancellableUntil: o.cancellable_until,
    cancelledAt: o.cancelled_at,
    canCancel:
      o.status === 'PENDING_PAYMENT' || (o.status === 'CONFIRMED' && new Date(o.cancellable_until) > new Date()),
    items: items.map((i) => ({
      bookId: i.book_id,
      title: i.title,
      authorName: i.author_name,
      format: i.format,
      quantity: i.quantity,
      unitPricePaise: i.unit_price_paise,
      cover: { bg: i.cover_bg, fg: i.cover_fg, accent: i.cover_accent },
    })),
  };
}

async function loadOrder(id, userId) {
  const o = await query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [id, userId]);
  if (!o.rows[0]) throw new AppError(404, 'Order not found');
  const items = await query(
    `SELECT oi.book_id, oi.quantity, oi.unit_price_paise, b.title, b.format, b.cover_bg, b.cover_fg, b.cover_accent,
            a.name AS author_name
     FROM order_items oi JOIN books b ON b.id = oi.book_id JOIN authors a ON a.id = b.author_id
     WHERE oi.order_id = $1 ORDER BY oi.id`,
    [id],
  );
  return mapOrder(o.rows[0], items.rows);
}

router.get('/orders', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  const ids = rows.map((r) => r.id);
  const items = ids.length
    ? (
        await query(
          `SELECT oi.order_id, oi.book_id, oi.quantity, oi.unit_price_paise, b.title, b.format, b.cover_bg, b.cover_fg,
                  b.cover_accent, a.name AS author_name
           FROM order_items oi JOIN books b ON b.id = oi.book_id JOIN authors a ON a.id = b.author_id
           WHERE oi.order_id = ANY($1::int[]) ORDER BY oi.id`,
          [ids],
        )
      ).rows
    : [];
  res.json({ orders: rows.map((o) => mapOrder(o, items.filter((i) => i.order_id === o.id))) });
});

router.get('/orders/:id', requireAuth, validate(idParam, 'params'), async (req, res) => {
  res.json({ order: await loadOrder(req.valid.params.id, req.user.id) });
});

export default router;
