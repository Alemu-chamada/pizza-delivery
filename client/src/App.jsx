import React, { useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Toast, Loader } from './components/common/UI';

// Pages
import { Home } from './pages/Home';
import { Dashboard } from './pages/Dashboard';
import { Account } from './pages/Account';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { AdminLogin } from './pages/AdminLogin';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { AccessState } from './pages/AccessState';
import { PizzaBuilder } from './pages/PizzaBuilder';
import { Checkout } from './pages/Checkout';
import { Payment } from './pages/Payment';
import { MyOrders } from './pages/MyOrders';
import { OrderTracking } from './pages/OrderTracking';
import { AdminOverview } from './pages/AdminOverview';
import { AdminInventory } from './pages/AdminInventory';
import { AdminOrders } from './pages/AdminOrders';
import { NotFound } from './pages/NotFound';

// Re-exports for component consumers and figma make kit compatibility
export {
  Logo,
  Button,
  Input,
  PasswordInput,
  Card,
  Badge,
  Alert,
  Loader,
  Skeleton,
  Toast,
  ConfirmDialog,
  StatusBadge,
} from './components/common/UI';
export { PizzaOptionCard } from './components/builder/PizzaOptionCard';
export { OrderStatusProgress } from './components/orders/OrderStatusProgress';
export { OrderCard } from './components/orders/OrderCard';

function AdminAccess({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-cream">
        <Loader />
      </main>
    );
  }

  if (!isAdmin) {
    return <AccessState type="forbidden" />;
  }

  return children;
}

function AppRoutes() {
  const [toast, setToast] = useState("");
  const location = useLocation();
  const { logout } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    const section = location.pathname.split("/").filter(Boolean)[0] || "home";
    const labels = {
      home: "Home",
      account: "Account",
      admin: "Admin",
      build: "Pizza Builder",
      checkout: "Checkout",
      dashboard: "Dashboard",
      orders: "Orders",
      payment: "Payment",
      login: "Login",
      register: "Register",
    };
    document.title = `${labels[section] || "Dough & Co."} · Dough & Co.`;
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    setToast("You’ve been logged out.");
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <Navbar onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/account" element={<Account />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login-required" element={<AccessState type="login" />} />
        <Route path="/forbidden" element={<AccessState type="forbidden" />} />
        <Route path="/session-expired" element={<AccessState type="expired" />} />
        <Route path="/build" element={<PizzaBuilder />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/orders/:id" element={<OrderTracking />} />
        <Route
          path="/admin"
          element={
            <AdminAccess>
              <AdminOverview />
            </AdminAccess>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <AdminAccess>
              <AdminInventory />
            </AdminAccess>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminAccess>
              <AdminOrders />
            </AdminAccess>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
