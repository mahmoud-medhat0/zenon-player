import { useState, useEffect, ReactNode } from 'react';
import { usePage, router, Link } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { showSuccess, showError } from '../utils/alerts';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

type DashboardTab = 'library' | 'analytics' | 'settings' | 'team';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: DashboardTab;
}

export default function DashboardLayout({ children, activeTab }: DashboardLayoutProps) {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const flash = props.flash;
  const { t } = useTranslation();

  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // User Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (flash?.success) showSuccess(flash.success);
    if (flash?.error) showError(flash.error);
  }, [flash]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isUploadOpen && !isUploading) {
          setIsUploadOpen(false);
          setUploadFile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploadOpen, isUploading]);

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
  };

  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const startUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadStatus(t('dashboard.upload.initiating'));

    try {
      const intentRes = await axios.post('/api/videos/upload-intent', { title: uploadFile.name, file_size: uploadFile.size });
      
      if (intentRes.data.type === 'cloudflare') {
        const { video_id, upload_url, cloudflare_uid } = intentRes.data;
        setUploadStatus('Uploading to Cloudflare Stream...');
        
        const formData = new FormData();
        formData.append('file', uploadFile);
        
        const cfAxios = axios.create();
        delete cfAxios.defaults.headers.common['X-Requested-With'];

        await cfAxios.post(upload_url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || uploadFile.size));
            setUploadProgress(percentCompleted);
            setUploadStatus(`Uploading: ${percentCompleted}%`);
          }
        });

        setUploadStatus(t('dashboard.upload.finalizing'));
        await axios.post(`/api/videos/${video_id}/cloudflare-confirm`, { cloudflare_uid });
      } else {
        const { video_id, upload_id } = intentRes.data;

        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(uploadFile.size / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
          setUploadStatus(t('dashboard.upload.chunkStatus', { current: i + 1, total: totalChunks }));
          const start = i * CHUNK_SIZE;
          const end = Math.min(uploadFile.size, start + CHUNK_SIZE);
          const chunk = uploadFile.slice(start, end, uploadFile.type || 'video/mp4');

          const formData = new FormData();
          formData.append('chunk', chunk, uploadFile.name);
          formData.append('chunk_index', i.toString());
          formData.append('upload_id', upload_id);

          await axios.post(`/api/videos/${video_id}/chunks`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        setUploadStatus(t('dashboard.upload.finalizing'));
        await axios.post(`/api/videos/${video_id}/confirm`, { upload_id, total_chunks: totalChunks });
      }

      setUploadStatus(t('dashboard.upload.complete'));
      showSuccess(t('dashboard.toasts.videoUploaded'));
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadProgress(0);
        setIsUploading(false);
        if (activeTab === 'library') {
          window.location.reload();
        } else {
          router.visit('/library');
        }
      }, 1000);
    } catch (err: any) {
      console.error('Upload error:', err);
      showError(t('dashboard.toasts.videoUploadFailed'), err.response?.data?.message || err.message);
      setIsUploading(false);
      setUploadStatus(t('dashboard.upload.failed'));
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <aside className="sidebar">
        <div className="logo text-gradient">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          {t('common.appName')}
        </div>

        <div style={{ marginBottom: '32px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {(user.tenant?.name || 'P')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('dashboard.sidebar.workspace')}</div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.tenant?.name || t('dashboard.sidebar.personal')}</div>
          </div>
        </div>

        <ul className="nav-menu" role="navigation" aria-label="Main navigation">
          <li>
            <Link href="/library" className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} aria-current={activeTab === 'library' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              {t('dashboard.sidebar.library')}
            </Link>
          </li>
          {hasFeature('analytics') && (
            <li>
              <Link href="/analytics" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} aria-current={activeTab === 'analytics' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                {t('dashboard.sidebar.analytics')}
              </Link>
            </li>
          )}
          {hasFeature('team_management') && user.role === 'owner' && (
            <li>
              <Link href="/team" className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} aria-current={activeTab === 'team' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                {t('dashboard.sidebar.team')}
              </Link>
            </li>
          )}
          <li>
            <Link href="/settings" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} aria-current={activeTab === 'settings' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              {t('dashboard.sidebar.settings')}
            </Link>
          </li>
          {isAdminUser && (
            <>
              <li style={{ listStyle: 'none', margin: '16px 0 8px', padding: '0 18px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.7 }}>{t('dashboard.sidebar.administration')}</li>
              <li>
                <Link href="/admin" className="nav-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  {t('dashboard.sidebar.adminOverview')}
                </Link>
              </li>
              <li>
                <Link href="/admin/users" className="nav-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a3 3 0 0 0-2-2.83"></path><path d="M16 3.13a3 3 0 0 1 0 5.74"></path></svg>
                  {t('dashboard.sidebar.adminUsers')}
                </Link>
              </li>
              <li>
                <Link href="/admin/tenants" className="nav-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v.01"></path><path d="M9 13v.01"></path><path d="M9 17v.01"></path></svg>
                  {t('dashboard.sidebar.adminTenants')}
                </Link>
              </li>
              <li>
                <Link href="/admin/plans" className="nav-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8z"></path><path d="M9 12l2 2 4-4"></path></svg>
                  {t('dashboard.sidebar.adminPlans')}
                </Link>
              </li>
            </>
          )}
        </ul>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="search-container">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" className="search-input" placeholder={t('dashboard.header.searchPlaceholder')} />
          </div>

          <div className="user-profile">
            <LanguageSwitcher />

            {hasFeature('basic_upload') && (
              <button className="btn-upload" onClick={() => setIsUploadOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                {t('dashboard.header.uploadVideo')}
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button className="avatar-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)} aria-expanded={isDropdownOpen} aria-haspopup="true" aria-label="User menu">
                <img src={`https://ui-avatars.com/api/?name=${user.name}&background=4f46e5&color=fff`} alt={user.name} className="avatar-img" />
              </button>

              {isDropdownOpen && (
                <div className="user-menu-popover">
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user?.name}>{user?.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user?.email}>{user?.email}</div>
                  </div>

                  <button
                    onClick={() => {
                      axios.post('/logout').then(() => {
                        window.location.href = '/login';
                      });
                    }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      padding: '8px',
                      cursor: 'pointer',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    {t('common.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard animate-fade-in">
          {children}
        </div>
      </main>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="modal-overlay" onClick={() => !isUploading && setIsUploadOpen(false)}>
          <div className="modal-content upload-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !isUploading && setIsUploadOpen(false)} disabled={isUploading}>
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 600 }}>{t('dashboard.upload.title')}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>{t('dashboard.upload.subtitle')}</p>

            {!isUploading && !uploadFile && (
              <div 
                style={{ 
                  border: '2px dashed var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '48px', 
                  textAlign: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: 'rgba(255,255,255,0.02)'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.background = 'rgba(79, 70, 229, 0.05)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                }}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>{t('dashboard.upload.dropzoneTitle')}</h3>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 24px 0', fontSize: '14px' }}>{t('dashboard.upload.dropzoneDesc')}</p>
                <input
                  id="file-upload"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <button className="btn-primary" style={{ padding: '12px 32px' }}>{t('dashboard.upload.selectBtn')}</button>
              </div>
            )}

            {uploadFile && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(uploadFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                  </div>
                  {!isUploading && (
                    <button 
                      onClick={() => setUploadFile(null)}
                      style={{ padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '8px' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                {isUploading ? (
                  <div className="upload-progress-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{uploadStatus}</span>
                      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{uploadProgress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => { setIsUploadOpen(false); setUploadFile(null); }}
                      style={{ padding: '12px 24px' }}
                    >
                      {t('common.cancel')}
                    </button>
                    <button className="btn-primary" onClick={startUpload} style={{ padding: '12px 32px' }}>
                      {t('dashboard.upload.startBtn')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
