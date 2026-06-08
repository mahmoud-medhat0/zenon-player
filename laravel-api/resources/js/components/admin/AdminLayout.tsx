import React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PageProps } from '../../types';
import { LayoutDashboard, Users, Building2, Shield, LogOut, ChevronRight, Film, BarChart3, Settings, ArrowLeft } from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const url = usePage().url;

  const handleLogout = () => {
    router.post('/logout');
  };

  const navItems = [
    {
      section: t('admin.layout.sections.main'),
      items: [
        { label: t('admin.layout.nav.dashboard'), href: '/admin', icon: LayoutDashboard },
        { label: t('admin.layout.nav.users'), href: '/admin/users', icon: Users },
        { label: t('admin.layout.nav.tenants'), href: '/admin/tenants', icon: Building2 },
        { label: t('admin.layout.nav.plans'), href: '/admin/plans', icon: Shield },
      ],
    },
    {
      section: t('admin.layout.sections.tools'),
      items: [
        { label: t('admin.layout.nav.analytics'), href: '/analytics', icon: BarChart3 },
        { label: t('admin.layout.nav.media'), href: '/library', icon: Film },
        { label: t('admin.layout.nav.settings'), href: '/settings', icon: Settings },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return url === '/admin';
    return url.startsWith(href);
  };

  const formatRole = (role?: string) => role
    ? t(`admin.roles.${role}`, { defaultValue: role.replace('_', ' ') })
    : '';

  const formatPlan = (tier?: string) => tier
    ? t(`admin.planTiers.${tier}`, { defaultValue: `${tier} ${t('admin.layout.plan')}` })
    : '';

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <Link href="/admin" className="admin-logo">
            <Shield size={28} />
            <span>{t('admin.layout.adminPanel')}</span>
          </Link>
        </div>

        {user?.tenant && (
          <div className="admin-org-badge">
            <div className="admin-org-avatar">
              {user.tenant.name.charAt(0).toUpperCase()}
            </div>
            <div className="admin-org-info">
              <span className="admin-org-name" dir="auto">{user.tenant.name}</span>
              <span className="admin-org-plan">{formatPlan(user.tenant.plan_tier)}</span>
            </div>
          </div>
        )}

        <div className="admin-nav-scroll">
          {navItems.map((group, groupIndex) => (
            <div key={groupIndex} className="admin-nav">
              <div className="admin-nav-section">{group.section}</div>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-item ${isActive(item.href) ? 'active' : ''}`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  <ChevronRight size={16} className="admin-nav-arrow" />
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=4f46e5&color=fff&bold=true&size=34`}
              alt={user?.name}
              className="admin-user-avatar"
            />
            <div className="admin-user-details">
              <span className="admin-user-name" dir="auto">{user?.name}</span>
              <span className="admin-user-role">{formatRole(user?.role)}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn" title={t('admin.layout.logout')}>
            <LogOut size={18} />
          </button>
        </div>
        <div className="admin-sidebar-back">
          <LanguageSwitcher />
          <Link href="/" className="admin-back-link">
            <ArrowLeft size={18} />
            <span>{t('admin.layout.backToApp')}</span>
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
