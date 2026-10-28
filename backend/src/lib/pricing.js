// Pure pricing logic. All amounts are integer paise. No I/O so it can be unit tested.

export function computeCouponOff(coupon, subtotalPaise, now = new Date()) {
  if (!coupon) return 0;
  if (!coupon.active) return 0;
  if (coupon.expires_at && new Date(coupon.expires_at) <= now) return 0;
  if (subtotalPaise < coupon.min_order_paise) return 0;
  let off = 0;
  if (coupon.percent_off != null) {
    off = Math.floor((subtotalPaise * coupon.percent_off) / 100);
    if (coupon.max_off_paise != null) off = Math.min(off, coupon.max_off_paise);
  } else if (coupon.flat_off_paise != null) {
    off = coupon.flat_off_paise;
  }
  return Math.min(off, subtotalPaise);
}

/**
 * @param {object} p
 * @param {{unitPricePaise:number, quantity:number}[]} p.items
 * @param {object} p.store  store policy row
 * @param {object|null} p.coupon  coupon row (already looked up) or null
 * @param {number} p.pointsRequested gift points the customer wants to redeem
 * @param {number} p.pointsAvailable gift points the customer owns
 */
export function computeTotals({ items, store, coupon = null, pointsRequested = 0, pointsAvailable = 0, now = new Date() }) {
  const subtotal = items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
  const couponOff = computeCouponOff(coupon, subtotal, now);
  const taxable = subtotal - couponOff;
  const tax = Math.round((taxable * store.tax_percent) / 100);
  const delivery = taxable >= store.free_delivery_above_paise || taxable === 0 ? 0 : store.delivery_charge_paise;
  const gross = taxable + tax + delivery;

  const maxPointsByValue = Math.ceil(gross / store.point_value_paise);
  const pointsUsed = Math.max(0, Math.min(Math.floor(pointsRequested), Math.floor(pointsAvailable), maxPointsByValue));
  const pointsOff = Math.min(pointsUsed * store.point_value_paise, gross);
  const total = gross - pointsOff;
  const pointsEarned = Math.floor(total / store.earn_paise_per_point);

  return {
    subtotalPaise: subtotal,
    couponOffPaise: couponOff,
    taxPaise: tax,
    deliveryPaise: delivery,
    pointsUsed,
    pointsOffPaise: pointsOff,
    totalPaise: total,
    pointsEarned,
  };
}
