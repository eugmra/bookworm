import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals, computeCouponOff } from '../src/lib/pricing.js';

const store = {
  tax_percent: 18,
  delivery_charge_paise: 4000,
  free_delivery_above_paise: 49900,
  point_value_paise: 100,
  earn_paise_per_point: 1000,
};
const items = [
  { unitPricePaise: 14900, quantity: 1 },
  { unitPricePaise: 35900, quantity: 1 },
];

test('totals without discounts', () => {
  const t = computeTotals({ items, store });
  assert.equal(t.subtotalPaise, 50800);
  assert.equal(t.taxPaise, 9144);
  assert.equal(t.deliveryPaise, 0); // above free-delivery threshold
  assert.equal(t.totalPaise, 59944);
  assert.equal(t.pointsEarned, 59);
});

test('delivery charged below threshold', () => {
  const t = computeTotals({ items: [{ unitPricePaise: 10000, quantity: 1 }], store });
  assert.equal(t.deliveryPaise, 4000);
  assert.equal(t.totalPaise, 10000 + 1800 + 4000);
});

test('percent coupon is capped and respects minimum order', () => {
  const coupon = { active: true, percent_off: 20, max_off_paise: 5000, min_order_paise: 30000, flat_off_paise: null, expires_at: null };
  assert.equal(computeCouponOff(coupon, 50800), 5000);
  assert.equal(computeCouponOff(coupon, 20000), 0);
});

test('expired or inactive coupons give nothing', () => {
  const base = { active: true, percent_off: null, flat_off_paise: 1000, max_off_paise: null, min_order_paise: 0, expires_at: null };
  assert.equal(computeCouponOff({ ...base, active: false }, 50000), 0);
  assert.equal(computeCouponOff({ ...base, expires_at: '2000-01-01T00:00:00Z' }, 50000), 0);
  assert.equal(computeCouponOff(base, 50000), 1000);
});

test('flat coupon never exceeds subtotal', () => {
  const coupon = { active: true, percent_off: null, flat_off_paise: 99999, max_off_paise: null, min_order_paise: 0, expires_at: null };
  assert.equal(computeCouponOff(coupon, 5000), 5000);
});

test('points limited by availability and by order value', () => {
  const t = computeTotals({ items, store, pointsRequested: 100000, pointsAvailable: 200 });
  assert.equal(t.pointsUsed, 200);
  assert.equal(t.pointsOffPaise, 20000);
  assert.equal(t.totalPaise, 59944 - 20000);

  const all = computeTotals({ items, store, pointsRequested: 100000, pointsAvailable: 100000 });
  assert.equal(all.totalPaise, 0);
  assert.equal(all.pointsUsed, 600); // ceil(59944 / 100)
});

test('negative or fractional point requests are sanitised', () => {
  const t = computeTotals({ items, store, pointsRequested: -50, pointsAvailable: 100 });
  assert.equal(t.pointsUsed, 0);
  const f = computeTotals({ items, store, pointsRequested: 10.9, pointsAvailable: 100 });
  assert.equal(f.pointsUsed, 10);
});
