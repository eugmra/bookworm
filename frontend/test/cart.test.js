import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCart, addToCart, setQuantity, loadCart, CART_KEY } from '../src/cart.js';

test('sanitizeCart drops bad rows, merges duplicates and caps quantity', () => {
  const out = sanitizeCart([
    { bookId: 1, quantity: 2 },
    { bookId: 1, quantity: 9 },
    { bookId: 'x', quantity: 1 },
    { bookId: 2, quantity: 0 },
    null,
  ]);
  assert.deepEqual(out, [{ bookId: 1, quantity: 10 }]);
});

test('sanitizeCart tolerates non-arrays', () => {
  assert.deepEqual(sanitizeCart({}), []);
});

test('addToCart and setQuantity', () => {
  let items = addToCart([], 5);
  items = addToCart(items, 5);
  assert.deepEqual(items, [{ bookId: 5, quantity: 2 }]);
  items = setQuantity(items, 5, 4);
  assert.deepEqual(items, [{ bookId: 5, quantity: 4 }]);
  assert.deepEqual(setQuantity(items, 5, 0), []);
});

test('loadCart survives corrupt storage', () => {
  const bad = { getItem: () => '{not json' };
  assert.deepEqual(loadCart(bad), []);
  const good = { getItem: (k) => (k === CART_KEY ? '[{"bookId":3,"quantity":1}]' : null) };
  assert.deepEqual(loadCart(good), [{ bookId: 3, quantity: 1 }]);
});
