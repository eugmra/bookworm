// End-to-end API check against a real database. Run: npm run test:e2e
// Needs backend/.env, a migrated + seeded database and the API NOT already on PORT 4010.
// Not named *.test.js so `npm test` (pure unit tests) does not require a database.
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { pool, query } from '../src/db.js';

const password = config.demoUserPassword;
assert.ok(password, 'DEMO_USER_PASSWORD must be set');

const server = createApp().listen(4010, '127.0.0.1');
const base = 'http://127.0.0.1:4010/api';

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

const address = {
  firstName: 'Asha', lastName: 'Rao', line1: '12 MG Road', city: 'Bengaluru', pin: '560001',
  state: 'Karnataka', country: 'India', email: 'asha@bookworm.test', phone: '+91 9876543210',
};
const card = { cardNumber: '4242 4242 4242 4242', nameOnCard: 'Asha Rao', cvv: '123', expiry: '12/2035' };

let step = 0;
const ok = (name) => process.stdout.write(`ok ${++step} - ${name}\n`);

try {
  const guest = client();

  const cats = await guest('GET', '/categories');
  assert.equal(cats.status, 200);
  assert.equal(cats.body.categories.length, 19);
  ok('categories (19)');

  const list = await guest('GET', '/books?category=self-help&sort=price_asc');
  assert.equal(list.status, 200);
  assert.ok(list.body.books.length >= 4);
  const prices = list.body.books.map((b) => b.pricePaise);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  ok('category filter + price sort');

  const search = await guest('GET', "/books?q=%25_'; DROP TABLE books;--");
  assert.equal(search.status, 200);
  assert.equal(search.body.total, 0);
  ok('hostile search text is harmless');

  const joy = (await guest('GET', '/books?q=Joy of Minimalism')).body.books[0];
  const detail = await guest('GET', `/books/${joy.id}`);
  assert.equal(detail.status, 200);
  assert.ok(detail.body.related.length > 0);
  assert.equal(detail.body.author.name, 'Daniel Reed');
  ok('product detail with related reads');

  assert.equal((await guest('GET', '/books/recommended')).status, 200);
  assert.equal((await guest('GET', '/orders')).status, 401);
  assert.equal((await guest('POST', '/orders', {})).status, 401);
  ok('guest recommendations; orders need login');

  const q1 = await guest('POST', '/checkout/quote', { items: [{ bookId: joy.id, quantity: 2 }] });
  assert.equal(q1.status, 200);
  assert.equal(q1.body.quote.subtotalPaise, joy.pricePaise * 2);
  const q2 = await guest('POST', '/checkout/quote', { items: [{ bookId: joy.id, quantity: 2 }], couponCode: 'NOPE' });
  assert.equal(q2.status, 400);
  ok('guest quote; invalid coupon rejected');

  const bad = await guest('POST', '/auth/login', { email: 'asha@bookworm.test', password: 'wrong-password-123' });
  assert.equal(bad.status, 401);
  const unknown = await guest('POST', '/auth/login', { email: 'nobody@bookworm.test', password: 'wrong-password-123' });
  assert.equal(unknown.status, 401);
  assert.equal(bad.body.error, unknown.body.error);
  ok('bad logins give the same generic 401');

  const asha = client();
  const login = await asha('POST', '/auth/login', { email: 'asha@bookworm.test', password });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'customer');
  const startPoints = login.body.user.giftPoints;
  ok('login');

  const rec = await asha('GET', '/books/recommended');
  assert.equal(rec.body.personalised, true);
  const history = await asha('GET', '/orders');
  assert.ok(history.body.orders.some((o) => o.status === 'CONFIRMED'));
  ok('order history + personalised recommendations');

  const stockBefore = (await query('SELECT stock FROM books WHERE id = $1', [joy.id])).rows[0].stock;

  // Pending order, then a declined card leaves everything untouched
  const created = await asha('POST', '/orders', {
    items: [{ bookId: joy.id, quantity: 2 }],
    couponCode: 'WELCOME10',
    pointsToUse: 50,
    address,
    saveAddress: true,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const order = created.body.order;
  assert.equal(order.status, 'PENDING_PAYMENT');
  assert.equal(order.pointsUsed, 50);
  assert.ok(order.couponOffPaise > 0);
  assert.equal(order.subtotalPaise, joy.pricePaise * 2);
  ok('create order with coupon + gift points');

  const declined = await asha('POST', `/orders/${order.id}/pay`, {
    method: 'credit_card',
    details: { ...card, cardNumber: '4000 0000 0000 0002' },
  });
  assert.equal(declined.status, 402);
  assert.equal((await asha('GET', `/orders/${order.id}`)).body.order.status, 'PENDING_PAYMENT');
  ok('declined card leaves order pending');

  const invalid = await asha('POST', `/orders/${order.id}/pay`, { method: 'credit_card', details: { ...card, cardNumber: '1234' } });
  assert.equal(invalid.status, 400);
  ok('invalid card number rejected');

  const paid = await asha('POST', `/orders/${order.id}/pay`, { method: 'credit_card', details: card });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.order.status, 'CONFIRMED');
  assert.ok(paid.body.order.canCancel);
  const stored = await query('SELECT card_last4, reference FROM payments WHERE order_id = $1', [order.id]);
  assert.equal(stored.rows[0].card_last4, '4242');
  const dump = JSON.stringify((await query('SELECT * FROM payments WHERE order_id = $1', [order.id])).rows);
  assert.ok(!dump.includes('4242424242424242'));
  ok('payment confirmed; only last4 stored');

  const stockAfter = (await query('SELECT stock FROM books WHERE id = $1', [joy.id])).rows[0].stock;
  assert.equal(stockAfter, stockBefore - 2);
  ok('stock decremented');

  const again = await asha('POST', `/orders/${order.id}/pay`, { method: 'credit_card', details: card });
  assert.equal(again.status, 409);
  ok('cannot pay twice');

  const cancel = await asha('POST', `/orders/${order.id}/cancel`);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.order.status, 'CANCELLED');
  assert.equal((await query('SELECT stock FROM books WHERE id = $1', [joy.id])).rows[0].stock, stockBefore);
  const me = await asha('GET', '/auth/me');
  assert.equal(me.body.user.giftPoints, startPoints);
  const refunds = await query(`SELECT 1 FROM payments WHERE order_id = $1 AND status = 'REFUNDED'`, [order.id]);
  assert.equal(refunds.rowCount, 1);
  ok('cancel restores stock, gift points and records refund');

  assert.equal((await asha('POST', `/orders/${order.id}/cancel`)).status, 409);
  ok('cannot cancel twice');

  // Cancellation window
  const late = await asha('POST', '/orders', { items: [{ bookId: joy.id, quantity: 1 }], addressId: undefined, address });
  assert.equal(late.status, 201);
  const latePaid = await asha('POST', `/orders/${late.body.order.id}/pay`, { method: 'upi', details: { upiId: 'asha@okbank' } });
  assert.equal(latePaid.status, 200);
  await query(`UPDATE orders SET cancellable_until = now() - interval '1 minute' WHERE id = $1`, [late.body.order.id]);
  const closed = await asha('POST', `/orders/${late.body.order.id}/cancel`);
  assert.equal(closed.status, 409);
  ok('cancellation blocked after the 48h window');

  // Out-of-stock protection
  const oos = await asha('POST', '/orders', { items: [{ bookId: joy.id, quantity: 10 }], address });
  assert.equal(oos.status, 201);
  await query('UPDATE books SET stock = 1 WHERE id = $1', [joy.id]);
  const oosPay = await asha('POST', `/orders/${oos.body.order.id}/pay`, { method: 'upi', details: { upiId: 'asha@okbank' } });
  assert.equal(oosPay.status, 409);
  ok('payment refused when stock ran out');

  // Isolation between users
  const other = client();
  const reg = await other('POST', '/auth/register', { name: 'Other Person', email: `other${Date.now()}@bookworm.test`, password: 'a-long-test-password-1' });
  assert.equal(reg.status, 201);
  assert.equal((await other('GET', `/orders/${order.id}`)).status, 404);
  assert.equal((await other('POST', `/orders/${order.id}/cancel`)).status, 404);
  assert.equal((await other('POST', '/store/books', {})).status, 403);
  ok("users cannot see others' orders or use admin routes");

  // Wishlist, writers, review
  assert.equal((await asha('PUT', `/me/wishlist/${joy.id}`)).status, 204);
  assert.equal((await asha('GET', '/me/wishlist')).body.books.length, 1);
  assert.equal((await asha('DELETE', `/me/wishlist/${joy.id}`)).status, 204);
  assert.equal((await asha('PUT', '/me/writers/1/follow')).status, 204);
  assert.equal((await asha('POST', `/books/${joy.id}/reviews`, { rating: 5, body: 'x'.repeat(101) })).status, 400);
  assert.equal((await asha('POST', `/books/${joy.id}/reviews`, { rating: 5, body: 'Lovely.' })).status, 201);
  ok('wishlist, follow writer, review (100 char limit)');

  const addrs = await asha('GET', '/me/addresses');
  assert.ok(addrs.body.addresses.length >= 1);
  ok('saved address returned');

  const adminC = client();
  assert.equal((await adminC('POST', '/auth/login', { email: 'admin@bookworm.test', password })).status, 200);
  const newBook = await adminC('POST', '/store/books', {
    title: `E2E Book ${Date.now()}`, authorId: 1, brandId: 1, categoryId: 1, kind: 'Fiction', format: 'Paperback',
    pricePaise: 19900, stock: 5,
  });
  assert.equal(newBook.status, 201);
  await query('DELETE FROM books WHERE id = $1', [newBook.body.id]);
  ok('admin can add a book');

  process.stdout.write(`\nAll ${step} end-to-end checks passed\n`);
} catch (err) {
  process.stderr.write(`\nFAILED after ${step} checks: ${err.message}\n${err.stack}\n`);
  process.exitCode = 1;
} finally {
  // Put test-mutated rows back so the demo data stays clean.
  await query(`UPDATE books SET stock = 120 WHERE title = 'Joy of Minimalism'`).catch(() => {});
  await query(`DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = (SELECT id FROM users WHERE email = 'asha@bookworm.test') AND created_at > now() - interval '1 hour')`).catch(() => {});
  await query(`DELETE FROM orders WHERE user_id = (SELECT id FROM users WHERE email = 'asha@bookworm.test') AND created_at > now() - interval '1 hour'`).catch(() => {});
  await query(`DELETE FROM users WHERE email LIKE 'other%@bookworm.test'`).catch(() => {});
  await query(`DELETE FROM addresses WHERE user_id = (SELECT id FROM users WHERE email = 'asha@bookworm.test')`).catch(() => {});
  await query(`DELETE FROM reviews WHERE body = 'Lovely.'`).catch(() => {});
  await query(`DELETE FROM author_follows`).catch(() => {});
  await query(`UPDATE users SET gift_points = 250, wallet_paise = 100000 WHERE email = 'asha@bookworm.test'`).catch(() => {});
  server.close();
  await pool.end();
}
