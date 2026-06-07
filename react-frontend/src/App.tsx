import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Dashboard from './Dashboard';
import EmbedPlayer from './components/EmbedPlayer';
import AdminLayout from './components/admin/AdminLayout';
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

function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/embed/:videoId" element={<EmbedPlayer />} />
      <Route path="/login" element={<Dashboard />} />

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
