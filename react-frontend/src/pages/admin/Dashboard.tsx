import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { Users, Building2, Shield, TrendingUp } from 'lucide-react';

interface DashboardStats {
  total_users: number;
  total_tenants: number;
  total_plans: number;
  recent_users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
    tenant: { name: string };
  }>;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, tenantsRes, plansRes] = await Promise.all([
          api.get('/admin/users?per_page=1'),
          api.get('/admin/tenants?per_page=1'),
          api.get('/plans'),
        ]);

        const recentUsersRes = await api.get('/admin/users?per_page=5');

        setStats({
          total_users: usersRes.data.pagination?.total || 0,
          total_tenants: tenantsRes.data.pagination?.total || 0,
          total_plans: plansRes.data.plans?.length || 0,
          recent_users: recentUsersRes.data.users || [],
        });
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.total_users || 0, icon: Users, color: 'indigo' },
    { label: 'Total Tenants', value: stats?.total_tenants || 0, icon: Building2, color: 'purple' },
    { label: 'Active Plans', value: stats?.total_plans || 0, icon: Shield, color: 'emerald' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="admin-page-subtitle">Here's what's happening across your platform.</p>
        </div>
      </div>

      <div className="admin-stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className={`admin-stat-card admin-stat-${card.color}`}>
            <div className="admin-stat-icon">
              <card.icon size={24} />
            </div>
            <div className="admin-stat-info">
              <span className="admin-stat-value">{card.value}</span>
              <span className="admin-stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <TrendingUp size={20} />
            Recent Users
          </h2>
        </div>
        <div className="admin-card-body">
          {stats?.recent_users && stats.recent_users.length > 0 ? (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Organization</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="admin-user-cell">
                          <img
                            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4f46e5&color=fff&bold=true&size=32`}
                            alt={u.name}
                            className="admin-table-avatar"
                          />
                          <div>
                            <span className="admin-table-name">{u.name}</span>
                            <span className="admin-table-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge-${u.role === 'super_admin' ? 'purple' : u.role === 'admin' ? 'blue' : 'gray'}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="admin-table-tenant">{u.tenant?.name}</td>
                      <td className="admin-table-date">{new Date(u.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-empty-text">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
