import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AdminLayout from '../../components/admin/AdminLayout';
import axios from 'axios';
import { showSuccess, showError } from '../../utils/alerts';
import { Search, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  plan_tier: string;
  is_active: boolean;
  users_count: number;
  created_at: string;
  plan?: {
    id: string;
    name: string;
    slug: string;
    max_users: number;
    max_storage_gb: number;
  };
}

interface TenantDetail extends Tenant {
  storage_used_gb: number;
  storage_limit_gb: number;
  users?: Array<{ id: string; name: string; email: string; role: string }>;
  videos?: Array<{ id: string; title: string; status: string }>;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

TenantsPage.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;

export default function TenantsPage() {
  const { t } = useTranslation();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Detail modal
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Assign plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planTenant, setPlanTenant] = useState<Tenant | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '10');
      params.set('page', page.toString());
      if (search) params.set('search', search);

      const res = await axios.get(`/api/admin/tenants?${params.toString()}`);
      setTenants(res.data.tenants);
      setPagination(res.data.pagination);
    } catch (err) {
      showError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const viewTenant = async (tenant: Tenant) => {
    try {
      const res = await axios.get(`/api/admin/tenants/${tenant.id}`);
      setSelectedTenant(res.data.tenant);
      setShowDetail(true);
    } catch (err) {
      showError('Failed to load tenant details');
    }
  };

  const openPlanModal = async (tenant: Tenant) => {
    setPlanTenant(tenant);
    setSelectedPlanId(tenant.plan?.id || '');
    try {
      const res = await axios.get('/api/plans');
      setPlans(res.data.plans);
    } catch (err) {
      console.error(err);
    }
    setShowPlanModal(true);
  };

  const assignPlan = async () => {
    if (!planTenant || !selectedPlanId) return;
    setAssigning(true);
    try {
      const res = await axios.put(`/api/admin/tenants/${planTenant.id}/plan`, { plan_id: selectedPlanId });
      const warnings = res.data.warnings;
      if (warnings && warnings.length > 0) {
        showSuccess('Plan assigned with warnings: ' + warnings.join(' '));
      } else {
        showSuccess('Plan assigned successfully');
      }
      setShowPlanModal(false);
      fetchTenants();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to assign plan');
    } finally {
      setAssigning(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTenants();
  };

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">{t('admin.tenants.title')}</h1>
          <p className="admin-page-subtitle">{t('admin.tenants.subtitle')}</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-toolbar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder={t('admin.tenants.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>

        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading"><div className="admin-spinner" /></div>
          ) : tenants.length === 0 ? (
            <p className="admin-empty-text">{t('admin.tenants.noTenants')}</p>
          ) : (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t('admin.tenants.name')}</th>
                      <th>{t('admin.tenants.plan')}</th>
                      <th>{t('admin.tenants.users')}</th>
                      <th>{t('admin.tenants.status')}</th>
                      <th>{t('admin.tenants.created')}</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-org-cell-avatar">
                              {tenant.name[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="admin-table-name">{tenant.name}</span>
                              <span className="admin-table-email">{tenant.id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge-${tenant.plan_tier === 'enterprise' ? 'purple' : tenant.plan_tier === 'pro' ? 'blue' : tenant.plan_tier === 'starter' ? 'emerald' : 'gray'}`}>
                            {tenant.plan_tier}
                          </span>
                        </td>
                        <td>{tenant.users_count}</td>
                        <td>
                          <span className={`admin-status-dot ${tenant.is_active ? 'active' : 'inactive'}`} />
                          {tenant.is_active ? 'Active' : 'Inactive'}
                        </td>
                        <td className="admin-table-date">{new Date(tenant.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-action-btn" onClick={() => viewTenant(tenant)} title={t('admin.tenants.details')}>
                              <Eye size={16} />
                            </button>
                            <button className="admin-btn admin-btn-sm" onClick={() => openPlanModal(tenant)}>
                              Change Plan
                            </button>
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
                    Page {pagination.current_page} of {pagination.last_page} ({pagination.total} tenants)
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

      {/* Tenant Detail Modal */}
      {showDetail && selectedTenant && (
        <div className="admin-modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{selectedTenant.name}</h2>
              <button className="admin-modal-close" onClick={() => setShowDetail(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-detail-grid">
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">{t('admin.tenants.plan')}</span>
                  <span className="admin-detail-value">{selectedTenant.plan?.name || selectedTenant.plan_tier}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">{t('admin.tenants.storage')}</span>
                  <span className="admin-detail-value">{selectedTenant.storage_used_gb} / {selectedTenant.storage_limit_gb} GB</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">{t('admin.tenants.users')}</span>
                  <span className="admin-detail-value">{selectedTenant.users?.length || 0} / {selectedTenant.plan?.max_users || '-'}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Videos</span>
                  <span className="admin-detail-value">{selectedTenant.videos?.length || 0}</span>
                </div>
              </div>

              {selectedTenant.users && selectedTenant.users.length > 0 && (
                <div className="admin-detail-section">
                  <h3>{t('admin.tenants.userList')}</h3>
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>{t('admin.tenants.name')}</th>
                          <th>Email</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTenant.users.map((u) => (
                          <tr key={u.id}>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>
                              <span className={`admin-badge admin-badge-${u.role === 'super_admin' ? 'purple' : u.role === 'admin' ? 'blue' : 'gray'}`}>
                                {u.role}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Plan Modal */}
      {showPlanModal && planTenant && (
        <div className="admin-modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Change Plan — {planTenant.name}</h2>
              <button className="admin-modal-close" onClick={() => setShowPlanModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
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
                <button className="admin-btn admin-btn-ghost" onClick={() => setShowPlanModal(false)}>{t('admin.tenants.close')}</button>
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
}
