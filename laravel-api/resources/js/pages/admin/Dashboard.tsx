import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PageProps } from '../../types';
import AdminLayout from '../../components/admin/AdminLayout';
import axios from 'axios';
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

AdminDashboard.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const currentLocale = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, tenantsRes, plansRes] = await Promise.all([
          axios.get('/api/admin/users?per_page=1'),
          axios.get('/api/admin/tenants?per_page=1'),
          axios.get('/api/plans'),
        ]);

        const recentUsersRes = await axios.get('/api/admin/users?per_page=5');

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
    { label: t('admin.dashboard.totalUsers'), value: stats?.total_users || 0, icon: Users, color: 'indigo' },
    { label: t('admin.dashboard.totalTenants'), value: stats?.total_tenants || 0, icon: Building2, color: 'purple' },
    { label: t('admin.dashboard.totalPlans'), value: stats?.total_plans || 0, icon: Shield, color: 'emerald' },
  ];

  const formatRole = (role: string) => t(`admin.roles.${role}`, { defaultValue: role.replace('_', ' ') });

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.dashboard.title')}</h1>
          <p className="admin-page-subtitle">{t('admin.dashboard.subtitle')}</p>
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
            {t('admin.dashboard.recentUsers')}
          </h2>
        </div>
        <div className="admin-card-body">
          {stats?.recent_users && stats.recent_users.length > 0 ? (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t('admin.dashboard.user')}</th>
                    <th>{t('admin.dashboard.role')}</th>
                    <th>{t('admin.dashboard.organization')}</th>
                    <th>{t('admin.dashboard.joined')}</th>
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
                            <span className="admin-table-name" dir="auto">{u.name}</span>
                            <span className="admin-table-email" dir="auto">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge-${u.role === 'super_admin' ? 'purple' : u.role === 'admin' ? 'blue' : 'gray'}`}>
                          {formatRole(u.role)}
                        </span>
                      </td>
                      <td className="admin-table-tenant" dir="auto">{u.tenant?.name}</td>
                      <td className="admin-table-date">{new Date(u.created_at).toLocaleDateString(currentLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-empty-text">{t('admin.dashboard.noRecentUsers')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
