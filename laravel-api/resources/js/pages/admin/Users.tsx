import { useState, useEffect, useCallback, FormEvent } from 'react';
import { usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { PageProps } from '../../types';
import AdminLayout from '../../components/admin/AdminLayout';
import axios from 'axios';
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

UsersPage.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;

export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const isSuperAdmin = user?.role === 'super_admin';
  const currentLocale = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] === 'ar' ? 'ar' : 'en';
  const roleOptions = [
    { value: 'owner', label: t('admin.roles.owner') },
    { value: 'admin', label: t('admin.roles.admin') },
    ...(isSuperAdmin ? [{ value: 'super_admin', label: t('admin.roles.super_admin') }] : []),
  ];

  const formatRole = (role: string) => t(`admin.roles.${role}`, { defaultValue: role.replace('_', ' ') });
  const getErrorMessage = (err: any) => {
    const errors = err.response?.data?.errors;
    if (errors) {
      const first = Object.values(errors).flat()[0];
      if (typeof first === 'string') return first;
    }
    return err.response?.data?.message || t('admin.users.failed');
  };

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

      const res = await axios.get(`/api/admin/users?${params.toString()}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } catch (err) {
      showError(t('admin.users.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchTenants = async () => {
    try {
      const res = await axios.get('/api/admin/tenants?per_page=100');
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

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword('');
    setFormPasswordConfirm('');
    setFormRole(u.role);
    setFormTenantId(u.tenant?.id || '');
    setFormActive(u.is_active);
    fetchTenants();
    setShowModal(true);
  };

  const openPlanModal = async (u: User) => {
    setPlanUser(u);
    try {
      const res = await axios.get('/api/plans');
      setPlans(res.data.plans);
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
      const res = await axios.put(`/api/admin/tenants/${planUser.tenant.id}/plan`, { plan_id: selectedPlanId });
      const warnings = res.data.warnings;
      if (warnings && warnings.length > 0) {
        showSuccess(t('admin.users.planAssignedWithWarnings'), warnings.join(' '));
      } else {
        showSuccess(t('admin.users.planAssignedSuccess'));
      }
      setShowPlanModal(false);
      fetchUsers();
    } catch (err: any) {
      showError(getErrorMessage(err));
    } finally {
      setAssigning(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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
        await axios.put(`/api/admin/users/${editingUser.id}`, payload);
        showSuccess(t('admin.users.updatedSuccess'));
      } else {
        await axios.post('/api/admin/users', {
          name: formName,
          email: formEmail,
          password: formPassword,
          password_confirmation: formPasswordConfirm,
          role: formRole,
          tenant_id: formTenantId,
        });
        showSuccess(t('admin.users.createdSuccess'));
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      showError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (u: User) => {
    const confirmed = await confirmDelete(
      t('admin.users.deleteTitle'),
      t('admin.users.confirmDelete')
    );
    if (!confirmed) return;

    try {
      await axios.delete(`/api/admin/users/${u.id}`);
      showSuccess(t('admin.users.deletedSuccess'));
      fetchUsers();
    } catch (err: any) {
      showError(getErrorMessage(err));
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.users.title')}</h1>
          <p className="admin-page-subtitle">{t('admin.users.subtitle')}</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          {t('admin.users.createUser')}
        </button>
      </div>

      <div className="admin-card">
        <div className="admin-card-toolbar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder={t('admin.users.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          >
            <option value="">{t('admin.users.allRoles')}</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>

        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading"><div className="admin-spinner" /></div>
          ) : users.length === 0 ? (
            <p className="admin-empty-text">{t('admin.users.noUsers')}</p>
          ) : (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.users.name')}</th>
                      <th>{t('admin.users.role')}</th>
                      <th>{t('admin.users.workspace')}</th>
                      <th>{t('admin.users.status')}</th>
                      <th>{t('admin.users.lastLogin')}</th>
                      <th className="admin-actions-heading">{t('admin.users.actions')}</th>
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
                        <td>
                          <span className={`admin-status-dot ${u.is_active ? 'active' : 'inactive'}`} />
                          {u.is_active ? t('common.active') : t('common.inactive')}
                        </td>
                        <td className="admin-table-date">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString(currentLocale) : t('admin.users.never')}
                        </td>
                        <td>
                          <div className="admin-actions">
                            {isSuperAdmin && (
                              <button className="admin-action-btn" onClick={() => openPlanModal(u)} title={t('admin.users.changePlan')} style={{ color: '#8b5cf6' }}>
                                <Shield size={16} />
                              </button>
                            )}
                            <button className="admin-action-btn" onClick={() => openEditModal(u)} title={t('common.edit')}>
                              <Edit2 size={16} />
                            </button>
                            {isSuperAdmin && u.role !== 'super_admin' && (
                              <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(u)} title={t('admin.users.deactivate')}>
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
                    {t('admin.users.pagination', {
                      page: pagination.current_page,
                      pages: pagination.last_page,
                      total: pagination.total,
                    })}
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
              <h2>{editingUser ? t('admin.users.editUser') : t('admin.users.createUser')}</h2>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div className="admin-form-group">
                <label>{t('admin.users.name')}</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>
              <div className="admin-form-group">
                <label>{t('admin.users.email')}</label>
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
                    <label>{t('admin.users.password')}</label>
                    <input
                      type="password"
                      className="admin-form-input"
                      placeholder={t('admin.users.passwordPlaceholder')}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label>{t('admin.users.passwordConfirmation')}</label>
                    <input
                      type="password"
                      className="admin-form-input"
                      placeholder={t('admin.users.passwordPlaceholder')}
                      value={formPasswordConfirm}
                      onChange={(e) => setFormPasswordConfirm(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>{t('admin.users.role')}</label>
                  <select
                    className="admin-form-select"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>
                {!editingUser && (
                  <div className="admin-form-group">
                    <label>{t('admin.users.tenant')}</label>
                    <select
                      className="admin-form-select"
                      value={formTenantId}
                      onChange={(e) => setFormTenantId(e.target.value)}
                      required
                    >
                      <option value="">{t('admin.users.tenantPlaceholder')}</option>
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
                    {t('common.active')}
                  </label>
                </div>
              )}
              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setShowModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting
                    ? (editingUser ? t('admin.users.updating') : t('admin.users.creating'))
                    : t('admin.users.save')}
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
              <h2>{t('admin.users.changePlanFor', { name: planUser.name })}</h2>
              <button className="admin-modal-close" onClick={() => setShowPlanModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
                {t('admin.users.changePlanDesc')} <strong dir="auto">({planUser.tenant?.name})</strong>.
              </p>
              <div className="admin-form-group">
                <label>{t('admin.users.selectPlan')}</label>
                <select
                  className="admin-form-select"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                >
                  <option value="">{t('admin.users.choosePlan')}</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="admin-modal-footer">
                <button className="admin-btn admin-btn-ghost" onClick={() => setShowPlanModal(false)}>{t('common.cancel')}</button>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={!selectedPlanId || assigning}
                  onClick={assignPlan}
                >
                  {assigning ? t('admin.users.assigningPlan') : t('admin.users.assignPlan')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
