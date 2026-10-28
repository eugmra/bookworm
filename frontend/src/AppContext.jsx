import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { addToCart, loadCart, setQuantity, CART_KEY } from './cart.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState(() => loadCart());
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* storage unavailable: cart lives in memory only */
    }
  }, [cart]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshUser = useCallback(async () => {
    const r = await api.me();
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      setUser,
      refreshUser,
      cart,
      cartCount: cart.reduce((n, i) => n + i.quantity, 0),
      addItem: (bookId, qty = 1) => {
        setCart((c) => addToCart(c, bookId, qty));
        setToast('Added to your basket');
      },
      changeQty: (bookId, qty) => setCart((c) => setQuantity(c, bookId, qty)),
      clearCart: () => setCart([]),
      toast,
      notify: setToast,
      logout: async () => {
        await api.logout().catch(() => {});
        setUser(null);
      },
    }),
    [user, ready, cart, toast, refreshUser],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
