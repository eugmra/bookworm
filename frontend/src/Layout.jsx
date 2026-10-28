import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from './AppContext.jsx';

export default function Layout() {
  const { user, cartCount, logout, toast } = useApp();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Book Worm
        </Link>
        <nav aria-label="Main">
          <NavLink to="/orders">My Orders</NavLink>
          <NavLink to="/wishlist">My Wishlist</NavLink>
          <NavLink to="/writers">My Writers</NavLink>
        </nav>
        <div className="topbar-right">
          <Link to="/checkout" className="cart-link" aria-label={`Basket, ${cartCount} items`}>
            <span aria-hidden="true">🛒</span>
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </Link>
          {user ? (
            <>
              <span className="small muted" title="Gift points">
                {user.name} · {user.giftPoints} pts
              </span>
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await logout();
                  navigate('/');
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer small muted">Book Worm · Prices in INR · Free delivery on eligible orders</footer>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
