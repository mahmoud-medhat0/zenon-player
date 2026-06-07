import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
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

const TenantsPage: React.FC = () => {
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

      const res = await api.get(`/admin/tenants?${params.toString()}`);
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
      const res = await api.get(`/admin/tenants/${tenant.id}`);
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
      const res = await api.get('/plans');
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
      const res = await api.put(`/admin/tenants/${planTenant.id}/plan`, { plan_id: selectedPlanId });
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
          <h1 className="admin-page-title">Tenants</h1>
          <p className="admin-page-subtitle">Manage organizations and their subscriptions</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-toolbar">
          <form onSubmit={handleSearchSubmit} className="admin-search-form">
            <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              className="admin-search-input"
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        </div>

        <div className="admin-card-body">
          {loading ? (
            <div className="admin-loading"><div className="admin-spinner" /></div>
          ) : tenants.length === 0 ? (
            <p className="admin-empty-text">No tenants found.</p>
          ) : (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Plan</th>
                      <th>Users</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-org-cell-avatar">
                              {t.name[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="admin-table-name">{t.name}</span>
                              <span className="admin-table-email">{t.id.substring(0, 8)}...</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge-${t.plan_tier === 'enterprise' ? 'purple' : t.plan_tier === 'pro' ? 'blue' : t.plan_tier === 'starter' ? 'emerald' : 'gray'}`}>
                            {t.plan_tier}
                          </span>
                        </td>
                        <td>{t.users_count}</td>
                        <td>
                          <span className={`admin-status-dot ${t.is_active ? 'active' : 'inactive'}`} />
                          {t.is_active ? 'Active' : 'Inactive'}
                        </td>
                        <td className="admin-table-date">{new Date(t.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-action-btn" onClick={() => viewTenant(t)} title="View Details">
                              <Eye size={16} />
                            </button>
                            <button className="admin-btn admin-btn-sm" onClick={() => openPlanModal(t)}>
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
                  <span className="admin-detail-label">Plan</span>
                  <span className="admin-detail-value">{selectedTenant.plan?.name || selectedTenant.plan_tier}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Storage</span>
                  <span className="admin-detail-value">{selectedTenant.storage_used_gb} / {selectedTenant.storage_limit_gb} GB</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Users</span>
                  <span className="admin-detail-value">{selectedTenant.users?.length || 0} / {selectedTenant.plan?.max_users || '-'}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Videos</span>
                  <span className="admin-detail-value">{selectedTenant.videos?.length || 0}</span>
                </div>
              </div>

              {selectedTenant.users && selectedTenant.users.length > 0 && (
                <div className="admin-detail-section">
                  <h3>Users</h3>
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
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

export default TenantsPage;
