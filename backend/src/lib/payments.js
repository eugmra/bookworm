import { randomBytes } from 'node:crypto';
import { AppError } from '../errors.js';

export function luhnValid(digits) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function parseExpiry(value, now = new Date()) {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  const year = Number(m[2]);
  // Card is valid through the last day of its expiry month.
  const endOfMonth = new Date(Date.UTC(year, month, 1));
  return endOfMonth > now ? { month, year } : null;
}

/**
 * Validates card/UPI details. Returns {last4} for cards.
 * Raw card data is validated and then discarded: it is never stored or logged.
 */
export function validatePaymentDetails(method, details = {}, now = new Date()) {
  if (method === 'credit_card' || method === 'debit_card') {
    const number = String(details.cardNumber ?? '').replace(/[\s-]/g, '');
    if (!luhnValid(number)) throw new AppError(400, 'Invalid card number');
    if (!/^[\p{L} .'-]{2,60}$/u.test(String(details.nameOnCard ?? '').trim())) {
      throw new AppError(400, 'Invalid name on card');
    }
    if (!/^\d{3,4}$/.test(String(details.cvv ?? ''))) throw new AppError(400, 'Invalid CVV');
    if (!parseExpiry(String(details.expiry ?? ''), now)) throw new AppError(400, 'Card expired or expiry invalid');
    return { last4: number.slice(-4), number };
  }
  if (method === 'upi') {
    if (!/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(String(details.upiId ?? ''))) {
      throw new AppError(400, 'Invalid UPI ID');
    }
    return {};
  }
  return {};
}

/**
 * Simulated payment gateway. No real money moves.
 * Test behaviour: a card number ending in 0002 is declined.
 */
export function chargeGateway(method, validated) {
  if (validated.number && validated.number.endsWith('0002')) {
    throw new AppError(402, 'Payment declined by the issuer', 'PAYMENT_DECLINED');
  }
  return { reference: `SIM-${method.toUpperCase()}-${randomBytes(6).toString('hex')}` };
}
