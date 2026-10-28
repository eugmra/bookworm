export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const detail = data?.details?.[0];
    const msg = detail ? `${detail.field ? detail.field + ': ' : ''}${detail.message}` : data?.error || 'Something went wrong';
    throw new ApiError(res.status, msg, data?.details);
  }
  return data;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  me: () => request('GET', '/auth/me'),
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (name, email, password) => request('POST', '/auth/register', { name, email, password }),
  logout: () => request('POST', '/auth/logout'),

  categories: () => request('GET', '/categories'),
  brands: (category) => request('GET', `/brands${qs({ category })}`),
  filters: () => request('GET', '/filters'),
  books: (params) => request('GET', `/books${qs(params)}`),
  bestsellers: () => request('GET', '/books/bestsellers'),
  newBooks: () => request('GET', '/books/new'),
  recommended: () => request('GET', '/books/recommended'),
  book: (id) => request('GET', `/books/${id}`),
  review: (id, rating, body) => request('POST', `/books/${id}/reviews`, { rating, body }),

  quote: (payload) => request('POST', '/checkout/quote', payload),
  createOrder: (payload) => request('POST', '/orders', payload),
  pay: (id, payload) => request('POST', `/orders/${id}/pay`, payload),
  cancelOrder: (id) => request('POST', `/orders/${id}/cancel`),
  orders: () => request('GET', '/orders'),
  order: (id) => request('GET', `/orders/${id}`),

  wishlist: () => request('GET', '/me/wishlist'),
  addWishlist: (id) => request('PUT', `/me/wishlist/${id}`),
  removeWishlist: (id) => request('DELETE', `/me/wishlist/${id}`),
  writers: () => request('GET', '/me/writers'),
  follow: (id) => request('PUT', `/me/writers/${id}/follow`),
  unfollow: (id) => request('DELETE', `/me/writers/${id}/follow`),
  addresses: () => request('GET', '/me/addresses'),
};
