import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, Building2, Shield, LogOut, ChevronRight, Film, BarChart3, Settings, ArrowLeft } from 'lucide-react';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const appNavItems = [
    { to: '/', icon: ArrowLeft, label: 'Back to App', isExternal: true },
    { to: '/?tab=library', icon: Film, label: 'Video Library' },
    { to: '/?tab=analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/?tab=settings', icon: Settings, label: 'Settings' },
  ];

  const adminNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/tenants', icon: Building2, label: 'Tenants' },
    { to: '/admin/plans', icon: Shield, label: 'Plans' },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <span>Stream</span>
          </div>
        </div>

        <div className="admin-org-badge">
          <div className="admin-org-avatar">
            {(user?.tenant?.name || 'A')[0].toUpperCase()}
          </div>
          <div className="admin-org-info">
            <span className="admin-org-name">{user?.tenant?.name || 'Organization'}</span>
            <span className="admin-org-plan">{user?.tenant?.plan_tier || 'free'} plan</span>
          </div>
        </div>

        <div className="admin-nav-scroll">
          <nav className="admin-nav">
            <div className="admin-nav-section">Application</div>
            {appNavItems.map((item) => (
              item.isExternal ? (
                <a
                  key={item.to}
                  href={item.to}
                  className="admin-nav-item"
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  <ChevronRight size={16} className="admin-nav-arrow" />
                </NavLink>
              )
            ))}
          </nav>

          <nav className="admin-nav">
            <div className="admin-nav-section">Administration</div>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                <ChevronRight size={16} className="admin-nav-arrow" />
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'A')}&background=4f46e5&color=fff&bold=true`}
              alt={user?.name}
              className="admin-user-avatar"
            />
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.name}</span>
              <span className="admin-user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="admin-logout-btn" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
