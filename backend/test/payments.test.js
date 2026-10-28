import test from 'node:test';
import assert from 'node:assert/strict';
import { luhnValid, parseExpiry, validatePaymentDetails, chargeGateway } from '../src/lib/payments.js';

test('luhn accepts valid and rejects invalid numbers', () => {
  assert.equal(luhnValid('4242424242424242'), true);
  assert.equal(luhnValid('4242424242424241'), false);
  assert.equal(luhnValid('abcd'), false);
  assert.equal(luhnValid('123'), false);
});

test('expiry parsing', () => {
  const now = new Date('2025-06-15T00:00:00Z');
  assert.ok(parseExpiry('06/2025', now));
  assert.equal(parseExpiry('05/2025', now), null);
  assert.equal(parseExpiry('13/2030', now), null);
  assert.equal(parseExpiry('6/30', now), null);
});

test('card validation returns last4 only for valid input', () => {
  const now = new Date('2025-01-01T00:00:00Z');
  const ok = validatePaymentDetails(
    'credit_card',
    { cardNumber: '4242 4242 4242 4242', nameOnCard: 'Asha Rao', cvv: '123', expiry: '12/2030' },
    now,
  );
  assert.equal(ok.last4, '4242');
  assert.throws(() =>
    validatePaymentDetails('credit_card', { cardNumber: '4242424242424241', nameOnCard: 'A B', cvv: '123', expiry: '12/2030' }, now),
  );
  assert.throws(() =>
    validatePaymentDetails('debit_card', { cardNumber: '4242424242424242', nameOnCard: 'A B', cvv: '12', expiry: '12/2030' }, now),
  );
});

test('upi validation', () => {
  assert.deepEqual(validatePaymentDetails('upi', { upiId: 'asha@okbank' }), {});
  assert.throws(() => validatePaymentDetails('upi', { upiId: 'not-an-upi' }));
});

test('gateway declines test card ending 0002', () => {
  assert.throws(() => chargeGateway('credit_card', { number: '4000000000000002' }), /declined/);
  const ok = chargeGateway('credit_card', { number: '4242424242424242' });
  assert.match(ok.reference, /^SIM-CREDIT_CARD-[0-9a-f]{12}$/);
});
