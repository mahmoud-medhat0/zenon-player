import { useState, useEffect, FormEvent } from 'react';
import { usePage } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { showSuccess, showError } from '../utils/alerts';
import ColorPicker from '../components/ColorPicker';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../layouts/DashboardLayout';
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, X } from 'lucide-react';

export default function Settings() {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const { t, i18n } = useTranslation();

  // Settings State
  const [settingsName, setSettingsName] = useState(user?.name || '');
  const [settingsEmail, setSettingsEmail] = useState(user?.email || '');
  const [settingsTenant, setSettingsTenant] = useState(user?.tenant?.name || '');
  
  const [settingsAllowedDomains, setSettingsAllowedDomains] = useState('');
  const [settingsWebhookUrl, setSettingsWebhookUrl] = useState('');
  const [settingsWebhookSecret, setSettingsWebhookSecret] = useState('');
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsPrimaryColor, setSettingsPrimaryColor] = useState('#4f46e5');
  const [settingsLogoUrl, setSettingsLogoUrl] = useState('');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // Vimeo Integration State
  const [vimeoToken, setVimeoToken] = useState('');
  const [vimeoVideos, setVimeoVideos] = useState<any[]>([]);
  const [isVimeoModalOpen, setIsVimeoModalOpen] = useState(false);
  const [isFetchingVimeo, setIsFetchingVimeo] = useState(false);
  const [vimeoSelectedVideos, setVimeoSelectedVideos] = useState<string[]>([]);
  const [isImportingVimeo, setIsImportingVimeo] = useState(false);
  const [vimeoPage, setVimeoPage] = useState(1);
  const [vimeoHasMore, setVimeoHasMore] = useState(false);
  const [isLoadingMoreVimeo, setIsLoadingMoreVimeo] = useState(false);

  // API Token State
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [newApiTokenName, setNewApiTokenName] = useState('');
  const [newApiTokenExpiresAt, setNewApiTokenExpiresAt] = useState('');
  const [apiTokenNeverExpires, setApiTokenNeverExpires] = useState(true);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [apiTokenError, setApiTokenError] = useState<string | null>(null);
  const [isCreatingApiToken, setIsCreatingApiToken] = useState(false);
  const [hasCopiedApiToken, setHasCopiedApiToken] = useState(false);

  useEffect(() => {
    if (user) {
      setSettingsName(user.name || '');
      setSettingsEmail(user.email || '');
      setSettingsTenant(user.tenant?.name || '');
      setSettingsWebhookUrl((user.tenant as any)?.webhook_url || '');
      setSettingsWebhookSecret((user.tenant as any)?.webhook_secret || '');
      setSettingsPrimaryColor((user.tenant as any)?.primary_color || '#4f46e5');
      setSettingsLogoUrl((user.tenant as any)?.logo_url || '');
      const domains = (user.tenant as any)?.allowed_domains || [];
      setSettingsAllowedDomains(Array.isArray(domains) ? domains.join('\n') : '');
    }
  }, [user]);

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      await axios.put('/api/settings/profile', { name: settingsName, email: settingsEmail });
      showSuccess(t('dashboard.toasts.profileUpdated'));
    } catch (err: any) {
      if (err.response?.data?.errors) {
        const errs = err.response.data.errors;
        showError(t('dashboard.toasts.profileFailed'), errs.name?.[0] || errs.email?.[0]);
      } else {
        showError(t('dashboard.toasts.profileFailed'), err.response?.data?.message);
      }
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdateTenant = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    const payload: any = { 
      name: settingsTenant,
      allowed_domains: settingsAllowedDomains.split('\n').map(d => d.trim()).filter(d => d !== ''),
      webhook_url: settingsWebhookUrl || null,
      webhook_secret: settingsWebhookSecret || null,
    };
    
    if (hasFeature('custom_branding')) {
      payload.primary_color = settingsPrimaryColor || null;
      payload.logo_url = settingsLogoUrl || null;
    }
    try {
      await axios.put('/api/settings/tenant', payload);
      showSuccess(t('dashboard.toasts.workspaceUpdated'));
    } catch (err: any) {
      if (err.response?.data?.errors) {
        const errs = err.response.data.errors;
        showError(t('dashboard.toasts.workspaceFailed'), errs.name?.[0]);
      } else {
        showError(t('dashboard.toasts.workspaceFailed'), err.response?.data?.message);
      }
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      await axios.put('/api/settings/password', {
        current_password: settingsCurrentPassword,
        new_password: settingsNewPassword,
      });
      setSettingsCurrentPassword('');
      setSettingsNewPassword('');
      showSuccess(t('dashboard.toasts.passwordUpdated'));
    } catch (err: any) {
      showError(t('dashboard.toasts.passwordFailed'), err.response?.data?.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const fetchApiTokens = async () => {
    if (!hasFeature('api_access')) return;
    try {
      const res = await axios.get('/api/tokens');
      setApiTokens(res.data.tokens);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchApiTokens();
  }, []);

  const createApiToken = async (e: FormEvent) => {
    e.preventDefault();
    setApiTokenError(null);

    let expiresAt: string | null = null;

    if (!apiTokenNeverExpires) {
      const selectedExpiration = new Date(newApiTokenExpiresAt);

      if (
        !newApiTokenExpiresAt
        || Number.isNaN(selectedExpiration.getTime())
        || selectedExpiration <= new Date()
      ) {
        setApiTokenError(t('dashboard.settings.api.invalidExpiration'));
        return;
      }

      expiresAt = selectedExpiration.toISOString();
    }

    setIsCreatingApiToken(true);

    try {
      const res = await axios.post('/api/tokens', {
        name: newApiTokenName,
        expires_at: expiresAt,
      });
      setGeneratedToken(res.data.token);
      setHasCopiedApiToken(false);
      setNewApiTokenName('');
      setNewApiTokenExpiresAt('');
      setApiTokenNeverExpires(true);
      fetchApiTokens();
    } catch (err: any) {
      const validationErrors = err.response?.data?.errors;

      if (validationErrors?.expires_at) {
        setApiTokenError(t('dashboard.settings.api.invalidExpiration'));
      } else if (validationErrors) {
        const firstValidationError = Object.values(validationErrors)
          .flat()
          .find(message => typeof message === 'string');
        setApiTokenError(
          typeof firstValidationError === 'string'
            ? firstValidationError
            : t('dashboard.settings.api.unexpectedError'),
        );
      } else if (!err.response) {
        setApiTokenError(t('dashboard.settings.api.networkError'));
      } else {
        setApiTokenError(
          err.response.data?.message || t('dashboard.settings.api.unexpectedError'),
        );
      }
    } finally {
      setIsCreatingApiToken(false);
    }
  };

  const copyApiToken = async () => {
    if (!generatedToken) return;

    try {
      await navigator.clipboard.writeText(generatedToken);
      setHasCopiedApiToken(true);
      setApiTokenError(null);
    } catch {
      setApiTokenError(t('dashboard.settings.api.copyFailed'));
    }
  };

  const deleteApiToken = async (id: string) => {
    if (!window.confirm(t('dashboard.toasts.confirmRevokeToken'))) return;
    try {
      await axios.delete(`/api/tokens/${id}`);
      fetchApiTokens();
      showSuccess(t('dashboard.toasts.tokenRevoked'));
    } catch (err) {
      showError(t('dashboard.toasts.tokenRevokeFailed'));
    }
  };

  const fetchVimeoVideos = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setIsFetchingVimeo(true);
    try {
      const res = await axios.get('/api/vimeo/videos', {
        params: {
          vimeo_access_token: vimeoToken || undefined,
          save_token: true,
          page: 1
        }
      });
      setVimeoVideos(res.data.videos);
      setVimeoHasMore(res.data.has_more);
      setVimeoPage(1);
      setVimeoSelectedVideos([]);
      setIsVimeoModalOpen(true);
    } catch (err: any) {
      showError(t('dashboard.toasts.vimeoFetchFailed'), err.response?.data?.message || t('dashboard.toasts.vimeoFetchHint'));
    } finally {
      setIsFetchingVimeo(false);
    }
  };

  const loadMoreVimeoVideos = async () => {
    setIsLoadingMoreVimeo(true);
    try {
      const nextPage = vimeoPage + 1;
      const res = await axios.get('/api/vimeo/videos', {
        params: {
          vimeo_access_token: vimeoToken || undefined,
          page: nextPage
        }
      });
      setVimeoVideos(prev => [...prev, ...res.data.videos]);
      setVimeoHasMore(res.data.has_more);
      setVimeoPage(nextPage);
    } catch (err: any) {
      showError(t('dashboard.toasts.vimeoFetchFailed'), err.response?.data?.message);
    } finally {
      setIsLoadingMoreVimeo(false);
    }
  };

  const loadAllVimeoVideos = async () => {
    setIsLoadingMoreVimeo(true);
    try {
      let currentPage = vimeoPage;
      let hasMore = vimeoHasMore;
      const allNewVideos: any[] = [];
      
      while (hasMore) {
        currentPage++;
        const res = await axios.get('/api/vimeo/videos', {
          params: {
            vimeo_access_token: vimeoToken || undefined,
            page: currentPage
          }
        });
        allNewVideos.push(...res.data.videos);
        hasMore = res.data.has_more;
      }
      
      setVimeoVideos(prev => [...prev, ...allNewVideos]);
      setVimeoHasMore(false);
      setVimeoPage(currentPage);
    } catch (err: any) {
      showError(t('dashboard.toasts.vimeoFetchFailed'), err.response?.data?.message);
    } finally {
      setIsLoadingMoreVimeo(false);
    }
  };

  const toggleVimeoSelection = (id: string) => {
    setVimeoSelectedVideos(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleImportVimeoVideos = async () => {
    setIsImportingVimeo(true);
    try {
      const selectedVideosData = vimeoVideos.filter(v => vimeoSelectedVideos.includes(v.id));
      await axios.post('/api/vimeo/import', {
        videos: selectedVideosData
      });
      setIsVimeoModalOpen(false);
      showSuccess(t('dashboard.toasts.vimeoImportStarted'));
      window.location.href = '/library';
    } catch (err: any) {
      showError(t('dashboard.toasts.vimeoImportFailed'), err.response?.data?.message);
    } finally {
      setIsImportingVimeo(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout activeTab="settings">
      <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <div className="page-header" style={{ marginBottom: '48px' }}>
          <div>
            <h1 className="section-title">{t('dashboard.settings.title')}</h1>
            <p className="section-subtitle">{t('dashboard.settings.subtitle')}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Profile Section */}
          <div className="settings-glass-card">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.profile.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.profile.desc')}</p>
              </div>
            </div>
            <form onSubmit={handleUpdateProfile} className="settings-form">
              <div className="settings-field">
                <label htmlFor="settings-name" className="settings-label">{t('dashboard.settings.profile.fullName')}</label>
                <input
                  id="settings-name"
                  type="text"
                  className="settings-input"
                  placeholder={t('dashboard.settings.profile.fullNamePlaceholder')}
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  required
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-email" className="settings-label">{t('dashboard.settings.profile.email')}</label>
                <input
                  id="settings-email"
                  type="email"
                  className="settings-input"
                  placeholder={t('dashboard.settings.profile.emailPlaceholder')}
                  value={settingsEmail}
                  onChange={e => setSettingsEmail(e.target.value)}
                  required
                />
              </div>
              <div className="settings-actions">
                <button type="submit" className="btn-settings-save" disabled={isUpdatingSettings}>
                  {isUpdatingSettings ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      {t('dashboard.settings.profile.save')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Workspace Section */}
          <div className="settings-glass-card">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper settings-icon-purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.workspace.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.workspace.desc')}</p>
              </div>
            </div>
            <form onSubmit={handleUpdateTenant} className="settings-form">
              <div className="settings-field">
                <label htmlFor="settings-tenant" className="settings-label">{t('dashboard.settings.workspace.name')}</label>
                <input
                  id="settings-tenant"
                  type="text"
                  className="settings-input"
                  placeholder={t('dashboard.settings.workspace.namePlaceholder')}
                  value={settingsTenant}
                  onChange={e => setSettingsTenant(e.target.value)}
                  required
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-domains" className="settings-label">{t('dashboard.settings.workspace.allowedDomains', 'Allowed Domains (CORS)')}</label>
                <textarea
                  id="settings-domains"
                  className="settings-input"
                  placeholder="https://your-academy.com&#10;http://localhost:3000"
                  value={settingsAllowedDomains}
                  onChange={e => setSettingsAllowedDomains(e.target.value)}
                  rows={3}
                  style={{ resize: 'vertical', fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Enter one domain per line. Examples: https://example.com, http://localhost:3000</p>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-webhook-url" className="settings-label">Webhook URL</label>
                <input
                  id="settings-webhook-url"
                  type="url"
                  className="settings-input"
                  placeholder="https://your-academy.com/api/zenon-webhook"
                  value={settingsWebhookUrl}
                  onChange={e => setSettingsWebhookUrl(e.target.value)}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>We will send POST requests here when a video finishes processing.</p>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-webhook-secret" className="settings-label">Webhook Secret (Optional)</label>
                <input
                  id="settings-webhook-secret"
                  type="text"
                  className="settings-input"
                  placeholder="e.g. random-secret-key"
                  value={settingsWebhookSecret}
                  onChange={e => setSettingsWebhookSecret(e.target.value)}
                />
              </div>
              {hasFeature('custom_branding') && (
                <>
                  <div className="settings-field">
                    <label htmlFor="settings-color" className="settings-label">{t('dashboard.settings.workspace.brandColor')}</label>
                    <ColorPicker 
                      color={settingsPrimaryColor} 
                      onChange={setSettingsPrimaryColor} 
                    />
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-logo" className="settings-label">{t('dashboard.settings.workspace.logoUrl')}</label>
                    <input
                      id="settings-logo"
                      type="url"
                      className="settings-input"
                      placeholder={t('dashboard.settings.workspace.logoPlaceholder')}
                      value={settingsLogoUrl}
                      onChange={e => setSettingsLogoUrl(e.target.value)}
                    />
                  </div>
                </>
              )}
              <div className="settings-actions">
                <button type="submit" className="btn-settings-save" disabled={isUpdatingSettings}>
                  {isUpdatingSettings ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      {t('dashboard.settings.workspace.save')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Security Section */}
          <div className="settings-glass-card">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper settings-icon-amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.security.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.security.desc')}</p>
              </div>
            </div>
            <form onSubmit={handleUpdatePassword} className="settings-form">
              <div className="settings-field">
                <label htmlFor="settings-current-password" className="settings-label">{t('dashboard.settings.security.currentPassword')}</label>
                <input
                  id="settings-current-password"
                  type="password"
                  className="settings-input"
                  placeholder={t('dashboard.settings.security.currentPasswordPlaceholder')}
                  value={settingsCurrentPassword}
                  onChange={e => setSettingsCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-new-password" className="settings-label">{t('dashboard.settings.security.newPassword')}</label>
                <input
                  id="settings-new-password"
                  type="password"
                  className="settings-input"
                  placeholder={t('dashboard.settings.security.newPasswordPlaceholder')}
                  value={settingsNewPassword}
                  onChange={e => setSettingsNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="settings-actions">
                <button type="submit" className="btn-settings-save btn-settings-save-amber" disabled={isUpdatingSettings}>
                  {isUpdatingSettings ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                      {t('dashboard.settings.security.update')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* API Tokens Section */}
          {hasFeature('api_access') && (
            <div className="settings-glass-card">
              <div className="settings-card-header">
                <div className="settings-icon-wrapper" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <div>
                  <h3 className="settings-card-title">{t('dashboard.settings.api.title')}</h3>
                  <p className="settings-card-subtitle">{t('dashboard.settings.api.desc')}</p>
                </div>
              </div>

              {apiTokenError && (
                <div className="api-token-alert api-token-alert-error" role="alert">
                  <div className="api-token-alert-icon">
                    <AlertCircle size={21} />
                  </div>
                  <div className="api-token-alert-content">
                    <strong>{t('dashboard.settings.api.creationError')}</strong>
                    <p>{apiTokenError}</p>
                  </div>
                  <button
                    type="button"
                    className="api-token-alert-close"
                    onClick={() => setApiTokenError(null)}
                    aria-label={t('common.close')}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              {generatedToken && (
                <div className="api-token-alert api-token-alert-success" role="status">
                  <div className="api-token-alert-icon">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="api-token-alert-content">
                    <strong>{t('dashboard.settings.api.tokenCreatedTitle')}</strong>
                    <p>{t('dashboard.settings.api.tokenWarning')}</p>
                    <div className="api-token-value-row">
                      <input
                        type="text"
                        readOnly
                        value={generatedToken}
                        className="api-token-value"
                        onFocus={event => event.currentTarget.select()}
                        aria-label={t('dashboard.settings.api.generatedToken')}
                      />
                      <button
                        type="button"
                        className={`api-token-copy-btn${hasCopiedApiToken ? ' copied' : ''}`}
                        onClick={copyApiToken}
                      >
                        {hasCopiedApiToken ? <Check size={17} /> : <Copy size={17} />}
                        {hasCopiedApiToken ? t('common.copied') : t('common.copy')}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="api-token-alert-close"
                    onClick={() => {
                      setGeneratedToken(null);
                      setHasCopiedApiToken(false);
                    }}
                    aria-label={t('common.close')}
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <form onSubmit={createApiToken} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={t('dashboard.settings.api.tokenName')}
                    value={newApiTokenName}
                    onChange={e => {
                      setNewApiTokenName(e.target.value);
                      setApiTokenError(null);
                    }}
                    required
                    style={{ flex: '1 1 260px', paddingLeft: '16px' }}
                  />
                  <button
                    type="submit"
                    disabled={isCreatingApiToken}
                    className="api-token-create-btn"
                  >
                    {isCreatingApiToken && <Loader2 size={17} className="api-token-spinner" />}
                    {isCreatingApiToken
                      ? t('dashboard.settings.api.creatingToken')
                      : t('dashboard.settings.api.createToken')}
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer', width: 'fit-content' }}>
                  <input
                    type="checkbox"
                    checked={apiTokenNeverExpires}
                    onChange={e => {
                      setApiTokenNeverExpires(e.target.checked);
                      setApiTokenError(null);
                    }}
                  />
                  {t('dashboard.settings.api.neverExpires')}
                </label>

                {!apiTokenNeverExpires && (
                  <div className="settings-field" style={{ marginBottom: 0, maxWidth: '360px' }}>
                    <label className="settings-label">{t('dashboard.settings.api.expirationDate')}</label>
                    <input
                      type="datetime-local"
                      className="input-field"
                      value={newApiTokenExpiresAt}
                      onChange={e => {
                        setNewApiTokenExpiresAt(e.target.value);
                        setApiTokenError(null);
                      }}
                      required
                    />
                  </div>
                )}
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {apiTokens.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>{t('dashboard.settings.api.noTokens')}</div>
                ) : apiTokens.map((token: any) => {
                  const isExpired = token.expires_at && new Date(token.expires_at) <= new Date();

                  return (
                    <div key={token.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{token.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('dashboard.settings.api.created')} {new Date(token.created_at).toLocaleDateString(i18n.language)}</div>
                        <div style={{ fontSize: '12px', color: isExpired ? '#ef4444' : 'var(--text-muted)', marginTop: '4px' }}>
                          {isExpired
                            ? t('dashboard.settings.api.expired')
                            : token.expires_at
                              ? `${t('dashboard.settings.api.expires')} ${new Date(token.expires_at).toLocaleString(i18n.language)}`
                              : t('dashboard.settings.api.neverExpires')}
                        </div>
                      </div>
                      <button onClick={() => deleteApiToken(token.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title={t('dashboard.settings.api.revoke')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vimeo Integration */}
          <div className="settings-glass-card">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.vimeo.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.vimeo.desc')}</p>
              </div>
            </div>
            
            <div className="settings-danger-content">
              <form onSubmit={fetchVimeoVideos} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="settings-field" style={{ marginBottom: 0 }}>
                  <label className="settings-label">{t('dashboard.settings.vimeo.token')}</label>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder={t('dashboard.settings.vimeo.tokenPlaceholder')}
                    value={vimeoToken}
                    onChange={e => setVimeoToken(e.target.value)}
                    disabled={isFetchingVimeo}
                  />
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>{t('dashboard.settings.vimeo.scopeWarning')}</p>
                </div>

                <div className="settings-actions" style={{ marginTop: '8px' }}>
                  <button type="submit" className="btn-settings-save" disabled={isFetchingVimeo} style={{ width: '100%' }}>
                    {isFetchingVimeo ? t('dashboard.settings.vimeo.fetching') : t('dashboard.settings.vimeo.fetchBtn')}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="settings-glass-card settings-card-danger">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper settings-icon-red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.danger.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.danger.desc')}</p>
              </div>
            </div>
            <div className="settings-danger-content">
              <p>{t('dashboard.settings.danger.warning')}</p>
              <button className="btn-settings-danger" type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                {t('dashboard.settings.danger.deleteAccount')}
              </button>
            </div>
          </div>

          {/* Help & Support Section */}
          <div className="settings-glass-card">
            <div className="settings-card-header">
              <div className="settings-icon-wrapper" style={{ color: hasFeature('priority_support') ? '#f59e0b' : '#3b82f6', background: hasFeature('priority_support') ? 'rgba(245, 158, 11, 0.1)' : 'rgba(59, 130, 246, 0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <h3 className="settings-card-title">{t('dashboard.settings.help.title')}</h3>
                <p className="settings-card-subtitle">{t('dashboard.settings.help.desc')}</p>
              </div>
            </div>
            <div className="settings-danger-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {hasFeature('priority_support') ? (
                <>
                  <div>
                    <h4 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>{t('dashboard.settings.help.vipTitle')}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('dashboard.settings.help.vipDesc')}</p>
                  </div>
                  <a href="mailto:vip@stream.com" style={{ padding: '12px 24px', background: 'var(--gradient-brand)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>{t('dashboard.settings.help.vipContact')}</a>
                </>
              ) : (
                <>
                  <div>
                    <h4 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>{t('dashboard.settings.help.communityTitle')}</h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{t('dashboard.settings.help.communityDesc')}</p>
                  </div>
                  <a href="#" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, border: '1px solid var(--border-color)' }}>{t('dashboard.settings.help.visitForums')}</a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vimeo Import Modal */}
      {isVimeoModalOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '40px', position: 'relative' }}>
            <button
              onClick={() => setIsVimeoModalOpen(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{t('dashboard.settings.vimeo.modalTitle')}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{t('dashboard.settings.vimeo.modalDesc')}</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button 
                onClick={() => setVimeoSelectedVideos(vimeoSelectedVideos.length === vimeoVideos.length ? [] : vimeoVideos.map(v => v.id))}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}
              >
                {vimeoSelectedVideos.length === vimeoVideos.length ? t('dashboard.settings.vimeo.deselectAll') : t('dashboard.settings.vimeo.selectAll')}
              </button>
              <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                {t('dashboard.settings.vimeo.selectedCount', { count: vimeoSelectedVideos.length })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', gridAutoRows: 'max-content' }}>
              {vimeoVideos.map(video => (
                <div 
                  key={video.id} 
                  onClick={() => toggleVimeoSelection(video.id)}
                  style={{ 
                    border: `2px solid ${vimeoSelectedVideos.includes(video.id) ? 'var(--primary)' : 'var(--border-color)'}`, 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all 0.2s',
                    background: vimeoSelectedVideos.includes(video.id) ? 'rgba(79, 70, 229, 0.05)' : 'transparent'
                  }}
                >
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>{t('dashboard.settings.vimeo.noThumb')}</div>
                    )}
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                      {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                    </div>
                    {vimeoSelectedVideos.includes(video.id) && (
                      <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px' }}>
                    <div 
                      className="video-title" 
                      style={{ fontSize: '14px', margin: 0 }} 
                      dir="auto" 
                      title={video.title}
                    >
                      {video.title || 'Untitled Video'}
                    </div>
                  </div>
                </div>
              ))}
              {vimeoVideos.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {t('dashboard.settings.vimeo.noVideos')}
                </div>
              )}
              {vimeoHasMore && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', gap: '16px', padding: '20px' }}>
                  <button 
                    onClick={loadMoreVimeoVideos} 
                    disabled={isLoadingMoreVimeo}
                    style={{ padding: '8px 24px', borderRadius: '24px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isLoadingMoreVimeo ? t('common.loading') : t('common.loadMore', 'Load More')}
                  </button>
                  <button 
                    onClick={loadAllVimeoVideos} 
                    disabled={isLoadingMoreVimeo}
                    style={{ padding: '8px 24px', borderRadius: '24px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {isLoadingMoreVimeo ? t('common.loading') : 'Load All Pages'}
                  </button>
                </div>
              )}
              </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setIsVimeoModalOpen(false)}
                style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleImportVimeoVideos}
                disabled={vimeoSelectedVideos.length === 0 || isImportingVimeo}
                className="btn-primary"
                style={{ padding: '12px 32px' }}
              >
                {isImportingVimeo ? t('dashboard.settings.vimeo.importing') : t('dashboard.settings.vimeo.importBtn', { count: vimeoSelectedVideos.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
