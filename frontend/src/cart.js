// Cart persisted in localStorage as [{bookId, quantity}]. Prices are never stored client-side.
export const CART_KEY = 'bw_cart';
export const MAX_QTY = 10;

export function sanitizeCart(raw) {
  if (!Array.isArray(raw)) return [];
  const merged = new Map();
  for (const it of raw) {
    const id = Number(it?.bookId);
    const qty = Number(it?.quantity);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(qty) || qty < 1) continue;
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + qty));
  }
  return [...merged].map(([bookId, quantity]) => ({ bookId, quantity }));
}

export function loadCart(storage = globalThis.localStorage) {
  try {
    return sanitizeCart(JSON.parse(storage.getItem(CART_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function addToCart(items, bookId, quantity = 1) {
  return sanitizeCart([...items, { bookId, quantity }]);
}

export function setQuantity(items, bookId, quantity) {
  if (quantity < 1) return items.filter((i) => i.bookId !== bookId);
  return items.map((i) => (i.bookId === bookId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i));
}
