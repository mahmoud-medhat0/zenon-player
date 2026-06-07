import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { showSuccess, showError, confirmDelete } from '../../utils/alerts';
import { Plus, Pencil, Trash2, X, Check, Users, HardDrive, Clock } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_storage_gb: number;
  max_video_length_sec: number;
  features: string[];
  is_active: boolean;
  tenants_count?: number;
}

const ALL_FEATURES = [
  { key: 'basic_upload', label: 'Basic Upload', category: 'Core' },
  { key: 'sd_streaming', label: 'SD Streaming', category: 'Streaming' },
  { key: 'hd_streaming', label: 'HD Streaming (1080p)', category: 'Streaming' },
  { key: '4k_streaming', label: '4K Streaming (2160p)', category: 'Streaming' },
  { key: 'analytics', label: 'Analytics', category: 'Features' },
  { key: 'custom_thumbnail', label: 'Custom Thumbnails', category: 'Features' },
  { key: 'privacy_controls', label: 'Privacy Controls', category: 'Features' },
  { key: 'team_management', label: 'Team Management', category: 'Features' },
  { key: 'api_access', label: 'API Access', category: 'Advanced' },
  { key: 'priority_support', label: 'Priority Support', category: 'Advanced' },
  { key: 'custom_branding', label: 'Custom Branding', category: 'Advanced' },
];

const FEATURE_CATEGORIES = ['Core', 'Streaming', 'Features', 'Advanced'];

const emptyForm = {
  name: '',
  slug: '',
  price_monthly: 0,
  price_yearly: 0,
  max_users: 1,
  max_storage_gb: 1,
  max_video_length_sec: 300,
  features: [] as string[],
  is_active: true,
};

const PlansPage: React.FC = () => {
  const { isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/admin/plans');
      setPlans(res.data.plans);
    } catch (err) {
      showError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_users: plan.max_users,
      max_storage_gb: plan.max_storage_gb,
      max_video_length_sec: plan.max_video_length_sec,
      features: [...plan.features],
      is_active: plan.is_active,
    });
    setShowModal(true);
  };

  const viewDetail = async (plan: Plan) => {
    try {
      const res = await api.get(`/admin/plans/${plan.id}`);
      setDetailPlan(res.data.plan);
      setShowDetail(true);
    } catch (err) {
      showError('Failed to load plan details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.id}`, form);
        showSuccess('Plan updated successfully');
      } else {
        await api.post('/admin/plans', form);
        showSuccess('Plan created successfully');
      }
      setShowModal(false);
      fetchPlans();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    const confirmed = await confirmDelete(
      'Delete Plan?',
      `Are you sure you want to delete "${plan.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.delete(`/admin/plans/${plan.id}`);
      showSuccess('Plan deleted');
      fetchPlans();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to delete plan');
    }
  };

  const toggleFeature = (key: string) => {
    setForm(prev => ({
      ...prev,
      features: prev.features.includes(key)
        ? prev.features.filter(f => f !== key)
        : [...prev.features, key],
    }));
  };

  const formatDuration = (seconds: number) => {
    if (seconds >= 3600) return `${seconds / 3600}h`;
    if (seconds >= 60) return `${seconds / 60}m`;
    return `${seconds}s`;
  };

  if (loading) {
    return <div className="admin-loading"><div className="admin-spinner" /></div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Plans</h1>
          <p className="admin-page-subtitle">Manage subscription plans, pricing, and feature access</p>
        </div>
        {isSuperAdmin && (
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>
            <Plus size={18} /> Create Plan
          </button>
        )}
      </div>

      {/* Plans Grid */}
      <div className="admin-plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className={`admin-plan-card ${!plan.is_active ? 'inactive' : ''}`}>
            {!plan.is_active && <div className="admin-plan-inactive-badge">Inactive</div>}
            <div className="admin-plan-header">
              <h3 className="admin-plan-name">{plan.name}</h3>
              <div className="admin-plan-price">
                <span className="admin-plan-amount">${plan.price_monthly}</span>
                <span className="admin-plan-period">/month</span>
              </div>
              {plan.price_yearly > 0 && (
                <span className="admin-plan-yearly">${plan.price_yearly}/year</span>
              )}
            </div>

            <div className="admin-plan-limits">
              <div className="admin-plan-limit">
                <Users size={16} />
                <span>{plan.max_users} users</span>
              </div>
              <div className="admin-plan-limit">
                <HardDrive size={16} />
                <span>{plan.max_storage_gb} GB storage</span>
              </div>
              <div className="admin-plan-limit">
                <Clock size={16} />
                <span>{formatDuration(plan.max_video_length_sec)} max video</span>
              </div>
            </div>

            <div className="admin-plan-features">
              {ALL_FEATURES.map((f) => (
                <div key={f.key} className={`admin-plan-feature ${plan.features.includes(f.key) ? 'included' : 'excluded'}`}>
                  {plan.features.includes(f.key) ? (
                    <Check size={14} className="feature-check" />
                  ) : (
                    <X size={14} className="feature-x" />
                  )}
                  <span>{f.label}</span>
                </div>
              ))}
            </div>

            <div className="admin-plan-actions">
              <button className="admin-btn admin-btn-sm" onClick={() => viewDetail(plan)}>
                Details
              </button>
              {isSuperAdmin && (
                <>
                  <button className="admin-btn admin-btn-sm" onClick={() => openEdit(plan)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button className="admin-btn admin-btn-sm admin-btn-danger-sm" onClick={() => handleDelete(plan)}>
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
              <button className="admin-modal-close" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="admin-modal-body">
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Business"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label>Slug</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="e.g. business"
                    required
                    disabled={!!editingPlan}
                  />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label>Price Monthly ($)</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={form.price_monthly}
                    onChange={(e) => setForm({ ...form, price_monthly: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label>Price Yearly ($)</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={form.price_yearly}
                    onChange={(e) => setForm({ ...form, price_yearly: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-row-3">
                <div className="admin-form-group">
                  <label>Max Users</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={form.max_users}
                    onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value) || 1 })}
                    min="1"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label>Storage (GB)</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={form.max_storage_gb}
                    onChange={(e) => setForm({ ...form, max_storage_gb: parseInt(e.target.value) || 1 })}
                    min="1"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label>Max Video (sec)</label>
                  <input
                    type="number"
                    className="admin-form-input"
                    value={form.max_video_length_sec}
                    onChange={(e) => setForm({ ...form, max_video_length_sec: parseInt(e.target.value) || 300 })}
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  />
                  Active Plan
                </label>
              </div>

              {/* Features */}
              <div className="admin-form-group">
                <label style={{ marginBottom: '12px', display: 'block' }}>Features</label>
                {FEATURE_CATEGORIES.map((cat) => (
                  <div key={cat} className="admin-feature-category">
                    <div className="admin-feature-category-label">{cat}</div>
                    <div className="admin-feature-toggles">
                      {ALL_FEATURES.filter(f => f.category === cat).map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className={`admin-feature-toggle ${form.features.includes(f.key) ? 'active' : ''}`}
                          onClick={() => toggleFeature(f.key)}
                        >
                          {form.features.includes(f.key) ? <Check size={14} /> : <X size={14} />}
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-modal-footer">
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && detailPlan && (
        <div className="admin-modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="admin-modal admin-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{detailPlan.name} — Details</h2>
              <button className="admin-modal-close" onClick={() => setShowDetail(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-detail-grid">
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Monthly Price</span>
                  <span className="admin-detail-value">${detailPlan.price_monthly}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Yearly Price</span>
                  <span className="admin-detail-value">${detailPlan.price_yearly}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Max Users</span>
                  <span className="admin-detail-value">{detailPlan.max_users}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Storage</span>
                  <span className="admin-detail-value">{detailPlan.max_storage_gb} GB</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Max Video</span>
                  <span className="admin-detail-value">{formatDuration(detailPlan.max_video_length_sec)}</span>
                </div>
                <div className="admin-detail-stat">
                  <span className="admin-detail-label">Tenants</span>
                  <span className="admin-detail-value">{detailPlan.tenants_count ?? 0}</span>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Enabled Features</h3>
                <div className="admin-detail-features">
                  {detailPlan.features.map((f) => {
                    const feature = ALL_FEATURES.find(af => af.key === f);
                    return (
                      <span key={f} className="admin-badge admin-badge-emerald">
                        <Check size={12} /> {feature?.label || f}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlansPage;
