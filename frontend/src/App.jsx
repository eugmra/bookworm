import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useApp } from './AppContext.jsx';
import Layout from './Layout.jsx';
import { Loading } from './components.jsx';
import Home from './pages/Home.jsx';
import BookPage from './pages/BookPage.jsx';
import Checkout from './pages/Checkout.jsx';
import Payment from './pages/Payment.jsx';
import Success from './pages/Success.jsx';
import Orders from './pages/Orders.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Writers from './pages/Writers.jsx';
import Login from './pages/Login.jsx';

function RequireAuth({ children }) {
  const { user, ready } = useApp();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="book/:id" element={<BookPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="payment/:id" element={<RequireAuth><Payment /></RequireAuth>} />
        <Route path="success/:id" element={<RequireAuth><Success /></RequireAuth>} />
        <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="wishlist" element={<RequireAuth><Wishlist /></RequireAuth>} />
        <Route path="writers" element={<RequireAuth><Writers /></RequireAuth>} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<p className="page">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
