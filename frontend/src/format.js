export const formatINR = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(paise / 100);

export const formatINRShort = (paise) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(paise / 100);

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const PRICE_RANGES = [
  { label: 'All', min: undefined, max: undefined },
  { label: 'Under ₹200', min: undefined, max: 19999 },
  { label: '₹200 – ₹400', min: 20000, max: 40000 },
  { label: 'Above ₹400', min: 40001, max: undefined },
];

export const METHOD_LABELS = {
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  upi: 'UPI',
  wallet: 'Wallet',
  gift_points: 'Gift points',
};
