import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { BoardPage } from './pages/BoardPage';
import { LoginPage } from './pages/LoginPage';
import { PickupPage } from './pages/PickupPage';
import { TodayPage } from './pages/TodayPage';
import { AllOrdersPage } from './pages/admin/AllOrdersPage';
import { MenuPage } from './pages/admin/MenuPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { UsersPage } from './pages/admin/UsersPage';

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<BoardPage />} />
        <Route path="pickup" element={<PickupPage />} />
        <Route path="availability" element={<AvailabilityPage />} />
        <Route path="today" element={<TodayPage />} />
        {user.role === 'admin' && (
          <>
            <Route path="admin/menu" element={<MenuPage />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/settings" element={<SettingsPage />} />
            <Route path="admin/reports" element={<ReportsPage />} />
            <Route path="admin/orders" element={<AllOrdersPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
