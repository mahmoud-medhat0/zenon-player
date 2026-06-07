import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { showSuccess, showError, confirmDelete } from '../../utils/alerts';
import { Plus, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight, Shield } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  tenant: { id: string; name: string };
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
}

const UsersPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPasswordConfirm, setFormPasswordConfirm] = useState('');
  const [formRole, setFormRole] = useState('admin');
  const [formTenantId, setFormTenantId] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);

  // Plan modal state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planUser, setPlanUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '10');
      params.set('page', page.toString());
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);

      const res = await api.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      showError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/admin/tenants?per_page=100');
      setTenants(res.data.tenants.map((t: any) => ({ id: t.id, name: t.name })));
    } catch (err) {
      console.error(err);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormPasswordConfirm('');
    setFormRole('admin');
    setFormTenantId('');
    setFormActive(true);
    fetchTenants();
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormPasswordConfirm('');
    setFormRole(user.role);
    setFormTenantId(user.tenant?.id || '');
    setFormActive(user.is_active);
    fetchTenants();
    setShowModal(true);
  };

  const openPlanModal = async (user: User) => {
    setPlanUser(user);
    // Try to fetch the tenant to see its current plan, or just show the dropdown
    try {
      const res = await api.get('/plans');
      setPlans(res.data.plans);
      // We don't have the user's current plan id in the User object directly, 
      // but we can let them select a new one.
      setSelectedPlanId('');
    } catch (err) {
      console.error(err);
    }
    setShowPlanModal(true);
  };

  const assignPlan = async () => {
    if (!planUser || !planUser.tenant || !selectedPlanId) return;
    setAssigning(true);
    try {
      const res = await api.put(`/admin/tenants/${planUser.tenant.id}/plan`, { plan_id: selectedPlanId });
      const warnings = res.data.warnings;
      if (warnings && warnings.length > 0) {
        showSuccess('Plan assigned with warnings: ' + warnings.join(' '));
      } else {
        showSuccess("Plan assigned successfully to user's organization");
      }
      setShowPlanModal(false);
      fetchUsers();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to assign plan');
    } finally {
      setAssigning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        const payload: any = {
          name: formName,
          email: formEmail,
          role: formRole,
          is_active: formActive,
        };
        await api.put(`/admin/users/${editingUser.id}`, payload);
        showSuccess('User updated successfully');
      } else {
        await api.post('/admin/users', {
          name: formName,
          email: formEmail,
          password: formPassword,
          password_confirmation: formPasswordConfirm,
          role: formRole,
          tenant_id: formTenantId,
        });
        showSuccess('User created successfully');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    const confirmed = await confirmDelete(
      'Deactivate User?',
      `Are you sure you want to deactivate ${user.name}? They will no longer be able to log in.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      showSuccess('User deactivated');
      fetchUsers();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-subtitle">Manage user accounts and roles</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          Create User
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-toolbar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>

        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading"><div className="admin-spinner" /></div>
          ) : users.length === 0 ? (
            <p className="admin-empty-text">No users found.</p>
          ) : (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Organization</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="admin-user-cell">
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4f46e5&color=fff&bold=true&size=36`}
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
                        <td>
                          <span className={`admin-status-dot ${u.is_active ? 'active' : 'inactive'}`} />
                          {u.is_active ? 'Active' : 'Inactive'}
                        </td>
                        <td className="admin-table-date">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td>
                          <div className="admin-actions">
                            {isSuperAdmin && (
                              <button className="admin-action-btn" onClick={() => openPlanModal(u)} title="Change Plan" style={{ color: '#8b5cf6' }}>
                                <Shield size={16} />
                              </button>
                            )}
                            <button className="admin-action-btn" onClick={() => openEditModal(u)} title="Edit">
                              <Edit2 size={16} />
                            </button>
                            {isSuperAdmin && u.role !== 'super_admin' && (
                              <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(u)} title="Deactivate">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && pagination.last_page > 1 && (
                <div className="admin-pagination">
                  <span className="admin-pagination-info">
                    Page {pagination.current_page} of {pagination.last_page} ({pagination.total} users)
                  </span>
                  <div className="admin-pagination-btns">
                    <button
                      className="admin-pagination-btn"
                      disabled={pagination.current_page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="admin-pagination-btn"
                      disabled={pagination.current_page >= pagination.last_page}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div className="admin-form-group">
                <label>Name</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>Email</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>
              {!editingUser && (
                <>
                  <div className="admin-form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="admin-form-input"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>Confirm Password</label>
                    <input
                      type="password"
                      className="admin-form-input"
                      value={formPasswordConfirm}
                      onChange={(e) => setFormPasswordConfirm(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Role</label>
                  <select
                    className="admin-form-select"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
                {!editingUser && (
                  <div className="admin-form-group">
                    <label>Organization</label>
                    <select
                      className="admin-form-select"
                      value={formTenantId}
                      onChange={(e) => setFormTenantId(e.target.value)}
                      required
                    >
                      <option value="">Select...</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {editingUser && (
                <div className="admin-form-group">
                  <label className="admin-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              )}
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {showPlanModal && planUser && (
        <div className="admin-modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Change Plan — {planUser.name}</h2>
              <button className="admin-modal-close" onClick={() => setShowPlanModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                Changing the plan for this user will update the subscription for their entire organization <strong>({planUser.tenant?.name})</strong>.
              </p>
              <div className="admin-form-group">
                <label>Select Plan</label>
                <select
                  className="admin-form-select"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  <option value="">Choose a plan...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={() => setShowPlanModal(false)}>Cancel</button>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={!selectedPlanId || assigning}
                  onClick={assignPlan}
                >
                  {assigning ? 'Assigning...' : 'Assign Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
