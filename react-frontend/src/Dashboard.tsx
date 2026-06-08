import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './index.css';
import { useAuth } from './context/AuthContext';
import api from './api/client';
import { confirmDelete, showSuccess, showError } from './utils/alerts';
import VideoPlayer from './components/VideoPlayer';
import SecureImage from './components/SecureImage';

export type DashboardTab = 'library' | 'analytics' | 'settings' | 'team';

const dashboardRoutes: Record<DashboardTab, string> = {
  library: '/library',
  analytics: '/analytics',
  settings: '/settings',
  team: '/team',
};

function Dashboard({ initialTab = 'library' }: { initialTab?: DashboardTab }) {
  const { user, logout, loading, hasFeature } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  // Videos State
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);

  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Edit Video State
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrivacy, setEditPrivacy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // Video Player State
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // User Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Settings State
  const [settingsName, setSettingsName] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsTenant, setSettingsTenant] = useState('');
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState('');
  const [settingsNewPassword, setSettingsNewPassword] = useState('');
  const [settingsPrimaryColor, setSettingsPrimaryColor] = useState('#4f46e5');
  const [settingsLogoUrl, setSettingsLogoUrl] = useState('');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  // API Token State
  const [apiTokens, setApiTokens] = useState<any[]>([]);
  const [newApiTokenName, setNewApiTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Team State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const canAccessTab = (tab: DashboardTab) => {
    if (tab === 'analytics') return hasFeature('analytics');
    if (tab === 'team') return hasFeature('team_management') && user?.role === 'owner';
    return true;
  };

  const navigateToTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    navigate(dashboardRoutes[tab]);
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (user && !canAccessTab(activeTab)) {
      navigateToTab('library');
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (user) {
      setSettingsName(user.name || '');
      setSettingsEmail(user.email || '');
      setSettingsTenant(user.tenant?.name || '');
      setSettingsPrimaryColor((user.tenant as any)?.primary_color || '#4f46e5');
      setSettingsLogoUrl((user.tenant as any)?.logo_url || '');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      const fetchAnalytics = async () => {
        setIsLoadingAnalytics(true);
        try {
          const res = await api.get('/analytics');
          setAnalytics(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingAnalytics(false);
        }
      };
      fetchAnalytics();
    }
  }, [activeTab, analytics]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      await api.put('/settings/profile', { name: settingsName, email: settingsEmail });
      showSuccess('Profile updated successfully');
    } catch (err: any) {
      showError('Failed to update profile', err.response?.data?.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      const payload: any = { name: settingsTenant };
      if (hasFeature('custom_branding')) {
        payload.primary_color = settingsPrimaryColor;
        payload.logo_url = settingsLogoUrl;
      }
      await api.put('/settings/tenant', payload);
      showSuccess('Workspace updated successfully. Please log in again to see changes globally.');
    } catch (err: any) {
      showError('Failed to update workspace', err.response?.data?.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      await api.put('/settings/password', { current_password: settingsCurrentPassword, new_password: settingsNewPassword });
      showSuccess('Password updated successfully');
      setSettingsCurrentPassword('');
      setSettingsNewPassword('');
    } catch (err: any) {
      showError('Failed to update password', err.response?.data?.message);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const fetchApiTokens = async () => {
    if (!hasFeature('api_access')) return;
    try {
      const res = await api.get('/tokens');
      setApiTokens(res.data.tokens);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') {
      fetchApiTokens();
    }
  }, [activeTab]);

  const createApiToken = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/tokens', { name: newApiTokenName });
      setGeneratedToken(res.data.token);
      setNewApiTokenName('');
      fetchApiTokens();
      showSuccess('Token created successfully');
    } catch (err: any) {
      showError('Failed to create token', err.response?.data?.message);
    }
  };

  const deleteApiToken = async (id: string) => {
    if (!window.confirm('Are you sure you want to revoke this token?')) return;
    try {
      await api.delete(`/tokens/${id}`);
      fetchApiTokens();
      showSuccess('Token revoked');
    } catch (err) {
      showError('Failed to revoke token');
    }
  };

  const fetchTeamMembers = async () => {
    if (!hasFeature('team_management') || user?.role !== 'owner') return;
    try {
      const res = await api.get('/team');
      setTeamMembers(res.data.users);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'team') {
      fetchTeamMembers();
    }
  }, [activeTab]);

  const handleInviteTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      await api.post('/team', { name: inviteName, email: inviteEmail, password: invitePassword });
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      fetchTeamMembers();
      showSuccess('Team member added successfully');
    } catch (err: any) {
      showError('Failed to add team member', err.response?.data?.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveTeamMember = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/team/${id}`);
      fetchTeamMembers();
      showSuccess('Team member removed');
    } catch (err: any) {
      showError('Failed to remove member', err.response?.data?.message);
    }
  };

  const fetchVideos = async () => {
    if (user) {
      try {
        const res = await api.get('/videos');
        setVideos(res.data.data || res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingVideos(false);
      }
    }
  };

  useEffect(() => {
    let interval: any;

    const pollVideos = async () => {
      try {
        const res = await api.get('/videos');
        const videoList = res.data.data || res.data;
        setVideos(videoList);
        setIsLoadingVideos(false);

        const hasProcessing = videoList.some((v: any) => v.status === 'processing');
        if (hasProcessing && !interval) {
          interval = setInterval(async () => {
            try {
              const pollRes = await api.get('/videos');
              const polledList = pollRes.data.data || pollRes.data;
              setVideos(polledList);
              if (!polledList.some((v: any) => v.status === 'processing')) {
                clearInterval(interval);
                interval = null;
              }
            } catch (err) {
              console.error(err);
            }
          }, 3000);
        }
      } catch (err) {
        console.error(err);
        setIsLoadingVideos(false);
      }
    };

    if (user) {
      pollVideos();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, uploadStatus]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-dark)' }}>
        <svg className="animate-spin" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#spinner-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <defs>
            <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const startUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadStatus('Initiating upload...');

    try {
      const intentRes = await api.post('/videos/upload-intent', { title: uploadFile.name, file_size: uploadFile.size });
      const { video_id, upload_id } = intentRes.data;

      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(uploadFile.size / CHUNK_SIZE);

      for (let i = 0; i < totalChunks; i++) {
        setUploadStatus(`Uploading chunk ${i + 1} of ${totalChunks}...`);
        const start = i * CHUNK_SIZE;
        const end = Math.min(uploadFile.size, start + CHUNK_SIZE);
        const chunk = uploadFile.slice(start, end, uploadFile.type || 'video/mp4');

        const formData = new FormData();
        formData.append('chunk', chunk, uploadFile.name);
        formData.append('chunk_index', i.toString());
        formData.append('upload_id', upload_id);

        await api.post(`/videos/${video_id}/chunks`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      }

      setUploadStatus('Finalizing upload...');
      await api.post(`/videos/${video_id}/confirm`, { upload_id, total_chunks: totalChunks });

      setUploadStatus('Upload Complete!');
      showSuccess('Video uploaded successfully');
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadProgress(0);
        setIsUploading(false);
        setUploadStatus('');
      }, 2000);

    } catch (err) {
      showError('Upload failed', 'Please try again.');
      setUploadStatus('Upload failed. Please try again.');
      setIsUploading(false);
    }
  };

  const saveVideoEdit = async () => {
    if (!editingVideo) return;
    setIsSaving(true);
    try {
      const payload: any = { title: editTitle };
      if (hasFeature('privacy_controls')) {
        payload.privacy = editPrivacy;
      }
      await api.put(`/videos/${editingVideo.id}`, payload);

      if (thumbnailFile) {
        setIsUploadingThumbnail(true);
        const formData = new FormData();
        formData.append('thumbnail', thumbnailFile);
        await api.post(`/videos/${editingVideo.id}/thumbnail`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await fetchVideos();
      setEditingVideo(null);
      setThumbnailFile(null);
      showSuccess('Changes saved');
    } catch (err) {
      showError('Failed to save changes');
      console.error(err);
    } finally {
      setIsSaving(false);
      setIsUploadingThumbnail(false);
    }
  };

  const deleteVideo = async () => {
    if (!editingVideo) return;

    const isConfirmed = await confirmDelete('Delete Video?', 'Are you sure you want to delete this video? This cannot be undone.');
    if (!isConfirmed) return;

    setIsSaving(true);
    try {
      await api.delete(`/videos/${editingVideo.id}`);
      await fetchVideos();
      setEditingVideo(null);
      showSuccess('Video deleted');
    } catch (err) {
      showError('Failed to delete video');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <aside className="sidebar">
        <div className="logo text-gradient">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Stream
        </div>

        <div style={{ marginBottom: '32px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {(user.tenant?.name || 'P')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Workspace</div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.tenant?.name || 'Personal'}</div>
          </div>
        </div>

        <ul className="nav-menu" role="navigation" aria-label="Main navigation">
          <li>
            <button type="button" className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => navigateToTab('library')} aria-current={activeTab === 'library' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Library
            </button>
          </li>
          {hasFeature('analytics') && (
            <li>
              <button type="button" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => navigateToTab('analytics')} aria-current={activeTab === 'analytics' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                Analytics
              </button>
            </li>
          )}
          {hasFeature('team_management') && user.role === 'owner' && (
            <li>
              <button type="button" className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => navigateToTab('team')} aria-current={activeTab === 'team' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Team
              </button>
            </li>
          )}
          <li>
            <button type="button" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigateToTab('settings')} aria-current={activeTab === 'settings' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Settings
            </button>
          </li>
          {(user.role === 'admin' || user.role === 'super_admin') && (
            <>
              <li style={{ listStyle: 'none', margin: '16px 0 8px', padding: '0 18px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.7 }}>Administration</li>
              <li>
                <button type="button" className="nav-item" onClick={() => navigate('/admin')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  Admin Panel
                </button>
              </li>
            </>
          )}
        </ul>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="search-container">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" className="search-input" placeholder="Search your library..." />
          </div>

          <div className="user-profile">
            {hasFeature('basic_upload') && (
              <button className="btn-upload" onClick={() => setIsUploadOpen(true)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Upload Video
              </button>
            )}

            <div style={{ position: 'relative' }}>
              <button className="avatar-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)} aria-expanded={isDropdownOpen} aria-haspopup="true" aria-label="User menu">
                <img src={`https://ui-avatars.com/api/?name=${user.name}&background=4f46e5&color=fff`} alt={user.name} className="avatar-img" />
              </button>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 12px)',
                  right: 0,
                  width: '280px',
                  background: 'var(--bg-sidebar)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color)',
                  padding: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  zIndex: 50,
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user?.name}>{user?.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user?.email}>{user?.email}</div>
                  </div>

                  <button
                    onClick={logout}
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
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard animate-fade-in">
          {activeTab === 'library' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="section-title">Video Library</h1>
                  <p className="section-subtitle">Manage and organize your video assets</p>
                </div>
              </div>

              <div className="video-grid">
                {isLoadingVideos ? (
                  <div style={{ color: 'var(--text-muted)' }}>Loading your library...</div>
                ) : videos.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>Your library is empty. Upload a video to get started!</div>
                ) : videos.map((video, index) => (
                  <div key={video.id} className="video-card" style={{ animation: `fadeIn 0.5s ease forwards ${index * 0.1}s`, opacity: 0 }}>
                    <div className="thumbnail-wrapper">
                      <SecureImage src={video.thumbnail} alt={video.title} className="thumbnail" />
                      <div className="duration" style={{ backgroundColor: video.status === 'failed' ? 'rgba(239, 68, 68, 0.9)' : undefined }}>
                        {video.status === 'ready' ? video.duration : video.status === 'failed' ? 'Failed' : 'Processing...'}
                      </div>
                      <div className="play-overlay" onClick={() => { if (video.status === 'ready') setPlayingVideo(video.id); }}>
                        <div className="play-icon">
                          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </div>
                    <div className="video-info">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 className="video-title">{video.title}</h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingVideo(video); setEditTitle(video.title); setEditPrivacy(video.privacy || 'private'); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                          onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
                          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                        </button>
                      </div>
                      <div className="video-meta">
                        <div className="meta-item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                          {video.views}
                        </div>
                        <div className="meta-item">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          {video.date}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'analytics' && (
            <div className="animate-fade-in">
              <div className="page-header">
                <div>
                  <h1 className="section-title">Analytics</h1>
                  <p className="section-subtitle">Insights into your video performance</p>
                </div>
              </div>
              {isLoadingAnalytics ? (
                <div style={{ color: 'var(--text-muted)' }}>Loading analytics...</div>
              ) : analytics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Total Videos</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_videos}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Total Views</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_views}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Total Duration</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_duration}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>Storage Used</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.storage_used}</div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '8px', background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Recent Activity</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {analytics.recent_activity.map((act: any, i: number) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: i !== analytics.recent_activity.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <span style={{ color: 'var(--text-main)' }}>{act.action}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{act.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Failed to load analytics.</div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
              <div className="page-header" style={{ marginBottom: '48px' }}>
                <div>
                  <h1 className="section-title">Settings</h1>
                  <p className="section-subtitle">Manage your account and workspace preferences</p>
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
                      <h3 className="settings-card-title">Profile Information</h3>
                      <p className="settings-card-subtitle">Update your account's profile information and email address.</p>
                    </div>
                  </div>
                  <form onSubmit={handleUpdateProfile} className="settings-form">
                    <div className="settings-field">
                      <label htmlFor="settings-name" className="settings-label">Full Name</label>
                      <input
                        id="settings-name"
                        type="text"
                        className="settings-input"
                        placeholder="Enter your full name"
                        value={settingsName}
                        onChange={e => setSettingsName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="settings-email" className="settings-label">Email Address</label>
                      <input
                        id="settings-email"
                        type="email"
                        className="settings-input"
                        placeholder="Enter your email address"
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
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Save Changes
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
                      <h3 className="settings-card-title">Workspace</h3>
                      <p className="settings-card-subtitle">Manage your workspace name displayed on your dashboard.</p>
                    </div>
                  </div>
                  <form onSubmit={handleUpdateTenant} className="settings-form">
                    <div className="settings-field">
                      <label htmlFor="settings-tenant" className="settings-label">Workspace Name</label>
                      <input
                        id="settings-tenant"
                        type="text"
                        className="settings-input"
                        placeholder="Enter workspace name"
                        value={settingsTenant}
                        onChange={e => setSettingsTenant(e.target.value)}
                        required
                      />
                    </div>
                    {hasFeature('custom_branding') && (
                      <>
                        <div className="settings-field">
                          <label htmlFor="settings-color" className="settings-label">Primary Brand Color</label>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                              id="settings-color"
                              type="color"
                              value={settingsPrimaryColor}
                              onChange={e => setSettingsPrimaryColor(e.target.value)}
                              style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                            />
                            <input
                              type="text"
                              className="settings-input"
                              value={settingsPrimaryColor}
                              onChange={e => setSettingsPrimaryColor(e.target.value)}
                              style={{ flex: 1, fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                        <div className="settings-field">
                          <label htmlFor="settings-logo" className="settings-label">Logo URL</label>
                          <input
                            id="settings-logo"
                            type="url"
                            className="settings-input"
                            placeholder="https://example.com/logo.png"
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
                            Saving...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            Save Workspace
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
                      <h3 className="settings-card-title">Security</h3>
                      <p className="settings-card-subtitle">Ensure your account is using a long, random password to stay secure.</p>
                    </div>
                  </div>
                  <form onSubmit={handleUpdatePassword} className="settings-form">
                    <div className="settings-field">
                      <label htmlFor="settings-current-password" className="settings-label">Current Password</label>
                      <input
                        id="settings-current-password"
                        type="password"
                        className="settings-input"
                        placeholder="Enter current password"
                        value={settingsCurrentPassword}
                        onChange={e => setSettingsCurrentPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="settings-new-password" className="settings-label">New Password</label>
                      <input
                        id="settings-new-password"
                        type="password"
                        className="settings-input"
                        placeholder="Enter new password (min. 8 characters)"
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
                            Updating...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                            Update Password
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
                        <h3 className="settings-card-title">Developer API Keys</h3>
                        <p className="settings-card-subtitle">Generate access tokens to interact with the API.</p>
                      </div>
                    </div>

                    {generatedToken && (
                      <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', marginBottom: '24px' }}>
                        <p style={{ color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>Please copy your new API token now. You won't be able to see it again!</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input type="text" readOnly value={generatedToken} className="input-field" style={{ flex: 1, fontFamily: 'monospace' }} />
                          <button onClick={() => { navigator.clipboard.writeText(generatedToken); alert('Copied!'); }} style={{ padding: '0 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                        </div>
                      </div>
                    )}

                    <form onSubmit={createApiToken} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Token name (e.g., CI/CD Pipeline)"
                        value={newApiTokenName}
                        onChange={e => setNewApiTokenName(e.target.value)}
                        required
                        style={{ flex: 1, paddingLeft: '16px' }}
                      />
                      <button type="submit" style={{ padding: '0 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>Create Token</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {apiTokens.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>No API tokens generated yet.</div>
                      ) : apiTokens.map((token: any) => (
                        <div key={token.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{token.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Created {new Date(token.created_at).toLocaleDateString()}</div>
                          </div>
                          <button onClick={() => deleteApiToken(token.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title="Revoke Token">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      <h3 className="settings-card-title">Danger Zone</h3>
                      <p className="settings-card-subtitle">Irreversible actions. Please proceed with caution.</p>
                    </div>
                  </div>
                  <div className="settings-danger-content">
                    <p>Once you delete your account, there is no going back. Please be certain.</p>
                    <button className="btn-settings-danger" type="button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete Account
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
                      <h3 className="settings-card-title">Help & Support</h3>
                      <p className="settings-card-subtitle">Get assistance with your account and features.</p>
                    </div>
                  </div>
                  <div className="settings-danger-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {hasFeature('priority_support') ? (
                      <>
                        <div>
                          <h4 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>VIP Priority Support</h4>
                          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>You have access to 24/7 dedicated engineering support.</p>
                        </div>
                        <a href="mailto:vip@stream.com" style={{ padding: '12px 24px', background: 'var(--gradient-brand)', color: 'white', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>Contact VIP Support</a>
                      </>
                    ) : (
                      <>
                        <div>
                          <h4 style={{ color: 'var(--text-main)', marginBottom: '4px' }}>Community Forum</h4>
                          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Find answers and connect with other creators.</p>
                        </div>
                        <a href="#" style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, border: '1px solid var(--border-color)' }}>Visit Forums</a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="page-header">
                <div>
                  <h2 className="section-title">Team Management</h2>
                  <p className="section-subtitle">Manage members of your workspace.</p>
                </div>
              </div>

              <div className="settings-glass-card">
                <div className="settings-card-header">
                  <div className="settings-icon-wrapper" style={{ color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.1)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                  </div>
                  <div>
                    <h3 className="settings-card-title">Invite Member</h3>
                    <p className="settings-card-subtitle">Add a new user to your workspace.</p>
                  </div>
                </div>

                <form onSubmit={handleInviteTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Name"
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      required
                      style={{ flex: 1, paddingLeft: '16px' }}
                    />
                    <input
                      type="email"
                      className="input-field"
                      placeholder="Email Address"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      style={{ flex: 1, paddingLeft: '16px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="Initial Password"
                      value={invitePassword}
                      onChange={e => setInvitePassword(e.target.value)}
                      required
                      minLength={8}
                      style={{ flex: 1, paddingLeft: '16px' }}
                    />
                    <button type="submit" disabled={isInviting} style={{ padding: '0 24px', height: '52px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, opacity: isInviting ? 0.7 : 1 }}>
                      {isInviting ? 'Inviting...' : 'Invite'}
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: '32px' }}>
                  <h3 className="settings-card-title" style={{ marginBottom: '16px' }}>Current Members</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamMembers.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>No other team members yet.</div>
                    ) : teamMembers.map((member: any) => (
                      <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {member.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {member.name}
                              {member.role === 'owner' && <span style={{ fontSize: '10px', background: 'var(--gradient-brand)', padding: '2px 6px', borderRadius: '8px', color: 'white' }}>OWNER</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</div>
                          </div>
                        </div>
                        {member.role !== 'owner' && (
                          <button onClick={() => handleRemoveTeamMember(member.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title="Remove Member">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {editingVideo && (
        <div role="dialog" aria-modal="true" aria-label="Edit Video" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Edit Video</h2>
            <div className="input-group">
              <input type="text" className="input-field" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>

            {hasFeature('privacy_controls') && (
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Privacy Settings</label>
                <select
                  className="input-field"
                  value={editPrivacy}
                  onChange={e => setEditPrivacy(e.target.value)}
                  style={{ paddingLeft: '16px', appearance: 'none' }}
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            )}

            {hasFeature('custom_thumbnail') && (
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Custom Thumbnail</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      if (e.target.files && e.target.files.length > 0) {
                        setThumbnailFile(e.target.files[0]);
                      }
                    }}
                    style={{
                      padding: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-muted)',
                      flex: 1
                    }}
                  />
                  {thumbnailFile && (
                    <button
                      onClick={() => setThumbnailFile(null)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}
                      title="Clear selection"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Direct Link</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  className="input-field"
                  value={`${window.location.origin}/embed/${editingVideo.id}`}
                  style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/embed/${editingVideo.id}`);
                    alert('Link copied to clipboard!');
                  }}
                  style={{ padding: '0 16px', background: 'var(--gradient-brand)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Copy Link
                </button>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Embed Code</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  className="input-field"
                  value={`<iframe src="${window.location.origin}/embed/${editingVideo.id}" width="640" height="360" style="width:100%;aspect-ratio:16/9;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`}
                  style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/embed/${editingVideo.id}" width="640" height="360" style="width:100%;aspect-ratio:16/9;border:0;" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`);
                    alert('Embed code copied to clipboard!');
                  }}
                  style={{ padding: '0 16px', background: 'var(--gradient-brand)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Copy Code
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveVideoEdit} disabled={isSaving || isUploadingThumbnail}>
                {isSaving || isUploadingThumbnail ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { setEditingVideo(null); setThumbnailFile(null); }} style={{ padding: '16px 24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={deleteVideo} disabled={isSaving} style={{ width: '100%', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
                Delete Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div role="dialog" aria-modal="true" aria-label="Upload Video" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Upload Video</h2>
              {!isUploading && (
                <button onClick={() => { setIsUploadOpen(false); setUploadFile(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>

            {!isUploading && !uploadFile && (
              <div className="dropzone" onClick={() => document.getElementById('file-upload')?.click()}>
                <div className="dropzone-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <input type="file" id="file-upload" style={{ display: 'none' }} accept="video/mp4,video/quicktime" onChange={handleFileSelect} />
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Click to browse or drag file here</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Supports MP4, MOV up to 10GB</div>
              </div>
            )}

            {uploadFile && (
              <div className="animate-fade-in">
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'rgba(79, 70, 229, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{uploadFile.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>

                {isUploading ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px', fontWeight: 500 }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--gradient-brand)', transition: 'width 0.4s ease' }}></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={startUpload}>Start Upload</button>
                    <button onClick={() => setUploadFile(null)} style={{ padding: '16px 24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>Cancel</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Player Modal */}
      {playingVideo && (
        <VideoPlayer
          videoId={playingVideo}
          token={localStorage.getItem('auth_token')}
          onClose={() => setPlayingVideo(null)}
          primaryColor={(user?.tenant as any)?.primary_color || '#4f46e5'}
        />
      )}
    </>
  );
}

export default Dashboard;
