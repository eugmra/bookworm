// Date helpers. Dates are handled as UTC to avoid server-timezone drift.

export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

export function estimatedDelivery(deliveryDays, now = new Date()) {
  return toDateString(addDays(now, deliveryDays));
}

export function cancelDeadline(paidAt, windowHours) {
  return new Date(new Date(paidAt).getTime() + windowHours * 3600 * 1000);
}
