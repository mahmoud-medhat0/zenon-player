import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import EmbedPlayer from './components/EmbedPlayer';
import AdminLayout from './components/admin/AdminLayout';
import LibraryPage from './pages/Library';
import AnalyticsPage from './pages/Analytics';
import TeamPage from './pages/Team';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import UsersPage from './pages/admin/Users';
import TenantsPage from './pages/admin/Tenants';
import PlansPage from './pages/admin/Plans';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="admin-loading" style={{ height: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <div className="admin-spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <AdminLayout>{children}</AdminLayout>;
};

const AppRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="admin-loading" style={{ height: '100vh', backgroundColor: 'var(--bg-dark)' }}>
        <div className="admin-spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppRoute><LibraryPage /></AppRoute>} />
      <Route path="/library" element={<AppRoute><LibraryPage /></AppRoute>} />
      <Route path="/analytics" element={<AppRoute><AnalyticsPage /></AppRoute>} />
      <Route path="/team" element={<AppRoute><TeamPage /></AppRoute>} />
      <Route path="/settings" element={<AppRoute><SettingsPage /></AppRoute>} />
      <Route path="/embed/:videoId" element={<EmbedPlayer />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <UsersPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/tenants"
        element={
          <AdminRoute>
            <TenantsPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/plans"
        element={
          <AdminRoute>
            <PlansPage />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default App;
