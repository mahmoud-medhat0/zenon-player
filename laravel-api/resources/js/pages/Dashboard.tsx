import { useState, useEffect, FormEvent } from 'react';
import { usePage, router } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { confirmDelete, showSuccess, showError } from '../utils/alerts';
import VideoPlayer from '../components/VideoPlayer';
import SecureImage from '../components/SecureImage';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import AdminSelect from '../components/AdminSelect';
import { X } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import ColorPicker from '../components/ColorPicker';

type DashboardTab = 'library' | 'analytics' | 'settings' | 'team';

const dashboardRoutes: Record<DashboardTab, string> = {
  library: '/library',
  analytics: '/analytics',
  settings: '/settings',
  team: '/team',
};

const isDashboardTab = (value: unknown): value is DashboardTab =>
  typeof value === 'string' && value in dashboardRoutes;

export default function Dashboard({ initialTab }: { initialTab?: DashboardTab } = {}) {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const flash = props.flash;
  const requestedTab = initialTab ?? (isDashboardTab(props.activeTab) ? props.activeTab : 'library');

  const [activeTab, setActiveTab] = useState<DashboardTab>(requestedTab);

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
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Team State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const { t, i18n } = useTranslation();
  const currentLocale = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] === 'ar' ? 'ar' : 'en';

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
  };

  const isAdminUser = user?.role === 'admin' || user?.role === 'super_admin';

  const canAccessTab = (tab: DashboardTab) => {
    if (tab === 'analytics') return hasFeature('analytics');
    if (tab === 'team') return hasFeature('team_management') && user?.role === 'owner';
    return true;
  };

  const navigateToTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    router.visit(dashboardRoutes[tab], {
      preserveScroll: true,
      preserveState: true,
    });
  };

  const formatRelativeDate = (value?: string, fallback = '') => {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const diffSeconds = (date.getTime() - Date.now()) / 1000;
    const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
      { unit: 'year', seconds: 31536000 },
      { unit: 'month', seconds: 2592000 },
      { unit: 'week', seconds: 604800 },
      { unit: 'day', seconds: 86400 },
      { unit: 'hour', seconds: 3600 },
      { unit: 'minute', seconds: 60 },
      { unit: 'second', seconds: 1 },
    ];
    const match = units.find(({ seconds }) => Math.abs(diffSeconds) >= seconds) || units[units.length - 1];

    return new Intl.RelativeTimeFormat(currentLocale, { numeric: 'auto' }).format(
      Math.round(diffSeconds / match.seconds),
      match.unit,
    );
  };

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

  useEffect(() => {
    if (flash?.success) showSuccess(flash.success);
    if (flash?.error) showError(flash.error);
  }, [flash]);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingVideo) setEditingVideo(null);
        if (isUploadOpen && !isUploading) {
          setIsUploadOpen(false);
          setUploadFile(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingVideo, isUploadOpen, isUploading]);

  useEffect(() => {
    if (user && !canAccessTab(activeTab)) {
      navigateToTab('library');
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      const fetchAnalytics = async () => {
        setIsLoadingAnalytics(true);
        try {
          const res = await axios.get('/api/analytics/overview');
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
        
        // Create a custom axios instance for this request without the default headers
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
      setUploadStatus(t('dashboard.upload.failed'));
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
      await axios.put(`/api/videos/${editingVideo.id}`, payload);

      if (thumbnailFile) {
        setIsUploadingThumbnail(true);
        const formData = new FormData();
        formData.append('thumbnail', thumbnailFile);
        await axios.post(`/api/videos/${editingVideo.id}/thumbnail`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      await fetchVideos();
      setEditingVideo(null);
      setThumbnailFile(null);
      showSuccess(t('dashboard.toasts.videoUpdated'));
    } catch (err) {
      showError(t('dashboard.toasts.videoUpdateFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
      setIsUploadingThumbnail(false);
    }
  };

  const deleteVideo = async () => {
    if (!editingVideo) return;

    const isConfirmed = await confirmDelete(t('dashboard.toasts.deleteVideoTitle'), t('dashboard.toasts.confirmDeleteVideo'));
    if (!isConfirmed) return;

    setIsSaving(true);
    try {
      await axios.delete(`/api/videos/${editingVideo.id}`);
      await fetchVideos();
      setEditingVideo(null);
      showSuccess(t('dashboard.toasts.videoDeleted'));
    } catch (err) {
      showError(t('dashboard.toasts.videoDeleteFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const fetchVideos = async () => {
    try {
      const res = await axios.get('/api/videos');
      setVideos(res.data.data || res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  useEffect(() => {
    let interval: any;

    const pollVideos = async () => {
      try {
        const res = await axios.get('/api/videos');
        const videoList = res.data.data || res.data;
        setVideos(videoList);
        setIsLoadingVideos(false);

        const hasProcessing = videoList.some((v: any) => v.status === 'processing');
        if (hasProcessing && !interval) {
          interval = setInterval(async () => {
            try {
              const pollRes = await axios.get('/api/videos');
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

  const handleImportVimeoVideos = async () => {
    if (vimeoSelectedVideos.length === 0) return;
    setIsImportingVimeo(true);
    
    const videosToImport = vimeoVideos.filter(v => vimeoSelectedVideos.includes(v.id));
    
    try {
      const res = await axios.post('/api/vimeo/import', { videos: videosToImport });
      showSuccess(res.data.message);
      setIsVimeoModalOpen(false);
      setVimeoSelectedVideos([]);
      navigateToTab('library'); // Take them to library to see the processing videos
    } catch (err: any) {
      showError(t('dashboard.toasts.vimeoImportFailed'), err.response?.data?.message);
    } finally {
      setIsImportingVimeo(false);
    }
  };

  const toggleVimeoSelection = (id: string) => {
    setVimeoSelectedVideos(prev => 
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      await axios.put('/api/settings/password', { current_password: settingsCurrentPassword, new_password: settingsNewPassword });
      showSuccess(t('dashboard.toasts.passwordUpdated'));
      setSettingsCurrentPassword('');
      setSettingsNewPassword('');
    } catch (err: any) {
      if (err.response?.data?.errors) {
        const errs = err.response.data.errors;
        showError(t('dashboard.toasts.passwordFailed'), errs.current_password?.[0] || errs.new_password?.[0]);
      } else {
        showError(t('dashboard.toasts.passwordFailed'), err.response?.data?.message);
      }
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
    if (activeTab === 'settings') {
      fetchApiTokens();
    }
  }, [activeTab]);

  const createApiToken = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/tokens', { name: newApiTokenName });
      setGeneratedToken(res.data.token);
      setNewApiTokenName('');
      fetchApiTokens();
      showSuccess(t('dashboard.toasts.tokenCreated'));
    } catch (err: any) {
      showError(t('dashboard.toasts.tokenFailed'), err.response?.data?.message);
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

  const fetchTeamMembers = async () => {
    if (!hasFeature('team_management') || user?.role !== 'owner') return;
    try {
      const res = await axios.get('/api/team');
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

  const handleInviteTeam = async (e: FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      await axios.post('/api/team', { name: inviteName, email: inviteEmail, password: invitePassword });
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      fetchTeamMembers();
      showSuccess(t('dashboard.toasts.memberAdded'));
    } catch (err: any) {
      showError(t('dashboard.toasts.memberAddFailed'), err.response?.data?.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveTeamMember = async (id: string) => {
    if (!window.confirm(t('dashboard.toasts.confirmRemoveMember'))) return;
    try {
      await axios.delete(`/api/team/${id}`);
      fetchTeamMembers();
      showSuccess(t('dashboard.toasts.memberRemoved'));
    } catch (err: any) {
      showError(t('dashboard.toasts.memberRemoveFailed'), err.response?.data?.message);
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
            <button type="button" className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => navigateToTab('library')} aria-current={activeTab === 'library' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              {t('dashboard.sidebar.library')}
            </button>
          </li>
          {hasFeature('analytics') && (
            <li>
              <button type="button" className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => navigateToTab('analytics')} aria-current={activeTab === 'analytics' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                {t('dashboard.sidebar.analytics')}
              </button>
            </li>
          )}
          {hasFeature('team_management') && user.role === 'owner' && (
            <li>
              <button type="button" className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => navigateToTab('team')} aria-current={activeTab === 'team' ? 'page' : undefined}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                {t('dashboard.sidebar.team')}
              </button>
            </li>
          )}
          <li>
            <button type="button" className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigateToTab('settings')} aria-current={activeTab === 'settings' ? 'page' : undefined}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              {t('dashboard.sidebar.settings')}
            </button>
          </li>
          {isAdminUser && (
            <>
              <li style={{ listStyle: 'none', margin: '16px 0 8px', padding: '0 18px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.7 }}>{t('dashboard.sidebar.administration')}</li>
              <li>
                <button type="button" className="nav-item" onClick={() => router.visit('/admin')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  {t('dashboard.sidebar.adminOverview')}
                </button>
              </li>
              <li>
                <button type="button" className="nav-item" onClick={() => router.visit('/admin/users')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a3 3 0 0 0-2-2.83"></path><path d="M16 3.13a3 3 0 0 1 0 5.74"></path></svg>
                  {t('dashboard.sidebar.adminUsers')}
                </button>
              </li>
              <li>
                <button type="button" className="nav-item" onClick={() => router.visit('/admin/tenants')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-4"></path><path d="M9 9v.01"></path><path d="M9 13v.01"></path><path d="M9 17v.01"></path></svg>
                  {t('dashboard.sidebar.adminTenants')}
                </button>
              </li>
              <li>
                <button type="button" className="nav-item" onClick={() => router.visit('/admin/plans')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8z"></path><path d="M9 12l2 2 4-4"></path></svg>
                  {t('dashboard.sidebar.adminPlans')}
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
          {activeTab === 'library' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="section-title">{t('dashboard.library.title')}</h1>
                  <p className="section-subtitle">{t('dashboard.library.subtitle')}</p>
                </div>
              </div>

              <div className="video-grid">
                {isLoadingVideos ? (
                  <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.library.loading')}</div>
                ) : videos.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.library.empty')}</div>
                ) : videos.map((video, index) => (
                  <div key={video.id} className="video-card" style={{ animation: `fadeIn 0.5s ease forwards ${index * 0.1}s`, opacity: 0 }}>
                    <div className="thumbnail-wrapper">
                      <SecureImage src={video.thumbnail} alt={video.title} className="thumbnail" />
                      <div className="duration" style={{ backgroundColor: video.status === 'failed' ? 'rgba(239, 68, 68, 0.9)' : undefined }}>
                        {video.status === 'ready' ? video.duration : video.status === 'failed' ? t('dashboard.library.failed') : t('dashboard.library.processing')}
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
                          {formatRelativeDate(video.created_at, video.date)}
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
                  <h1 className="section-title">{t('dashboard.analytics.title')}</h1>
                  <p className="section-subtitle">{t('dashboard.analytics.subtitle')}</p>
                </div>
              </div>
              {isLoadingAnalytics ? (
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.analytics.loading')}</div>
              ) : analytics ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.analytics.totalVideos')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_videos}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.analytics.totalViews')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_views}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.analytics.totalDuration')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.total_duration}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.analytics.storageUsed')}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-main)' }}>{analytics.storage_used}</div>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '8px', background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>{t('dashboard.analytics.recentActivity')}</h3>
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
                <div style={{ color: 'var(--text-muted)' }}>{t('dashboard.analytics.failed')}</div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
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

                    {generatedToken && (
                      <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '12px', marginBottom: '24px' }}>
                        <p style={{ color: '#10b981', fontWeight: 600, marginBottom: '8px' }}>{t('dashboard.settings.api.tokenWarning')}</p>
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
                        placeholder={t('dashboard.settings.api.tokenName')}
                        value={newApiTokenName}
                        onChange={e => setNewApiTokenName(e.target.value)}
                        required
                        style={{ flex: 1, paddingLeft: '16px' }}
                      />
                      <button type="submit" style={{ padding: '0 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600 }}>{t('dashboard.settings.api.createToken')}</button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {apiTokens.length === 0 ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>{t('dashboard.settings.api.noTokens')}</div>
                      ) : apiTokens.map((token: any) => (
                        <div key={token.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{token.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('dashboard.settings.api.created')} {new Date(token.created_at).toLocaleDateString()}</div>
                          </div>
                          <button onClick={() => deleteApiToken(token.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title={t('dashboard.settings.api.revoke')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      ))}
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
          )}

          {activeTab === 'team' && (
            <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
              <div className="page-header">
                <div>
                  <h2 className="section-title">{t('dashboard.team.title')}</h2>
                  <p className="section-subtitle">{t('dashboard.team.subtitle')}</p>
                </div>
              </div>

              <div className="settings-glass-card">
                <div className="settings-card-header">
                  <div className="settings-icon-wrapper" style={{ color: 'var(--primary)', background: 'rgba(79, 70, 229, 0.1)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                  </div>
                  <div>
                    <h3 className="settings-card-title">{t('dashboard.team.inviteTitle')}</h3>
                    <p className="settings-card-subtitle">{t('dashboard.team.inviteDesc')}</p>
                  </div>
                </div>

                <form onSubmit={handleInviteTeam} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={t('dashboard.team.name')}
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      required
                      style={{ flex: 1, paddingLeft: '16px' }}
                    />
                    <input
                      type="email"
                      className="input-field"
                      placeholder={t('dashboard.team.email')}
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
                      placeholder={t('dashboard.team.initialPassword')}
                      value={invitePassword}
                      onChange={e => setInvitePassword(e.target.value)}
                      required
                      minLength={8}
                      style={{ flex: 1, paddingLeft: '16px' }}
                    />
                    <button type="submit" disabled={isInviting} style={{ padding: '0 24px', height: '52px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, opacity: isInviting ? 0.7 : 1 }}>
                      {isInviting ? t('dashboard.team.inviting') : t('dashboard.team.invite')}
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: '32px' }}>
                  <h3 className="settings-card-title" style={{ marginBottom: '16px' }}>{t('dashboard.team.currentMembers')}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {teamMembers.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>{t('dashboard.team.noMembers')}</div>
                    ) : teamMembers.map((member: any) => (
                      <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {member.name[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {member.name}
                              {member.role === 'owner' && <span style={{ fontSize: '10px', background: 'var(--gradient-brand)', padding: '2px 6px', borderRadius: '8px', color: 'white' }}>{t('dashboard.team.owner')}</span>}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</div>
                          </div>
                        </div>
                        {member.role !== 'owner' && (
                          <button onClick={() => handleRemoveTeamMember(member.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px' }} title={t('dashboard.team.remove')}>
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
        <div role="dialog" aria-modal="true" aria-label={t('dashboard.edit.title')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '40px', position: 'relative' }}>
            <button
              onClick={() => setEditingVideo(null)}
              style={{ position: 'absolute', top: '16px', right: i18n.dir() === 'rtl' ? 'auto' : '16px', left: i18n.dir() === 'rtl' ? '16px' : 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              aria-label={t('common.close')}
            >
              <X size={20} />
            </button>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>{t('dashboard.edit.title')}</h2>
            <div className="input-group">
              <input type="text" className="input-field" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>

            {hasFeature('privacy_controls') && (
              <div style={{ marginTop: '24px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.edit.privacy')}</label>
                <AdminSelect
                  value={editPrivacy ? { value: editPrivacy, label: t(`dashboard.edit.${editPrivacy}`) } : null}
                  onChange={(opt: any) => setEditPrivacy(opt ? opt.value : 'private')}
                  options={[
                    { value: 'public', label: t('dashboard.edit.public') },
                    { value: 'unlisted', label: t('dashboard.edit.unlisted') },
                    { value: 'private', label: t('dashboard.edit.private') }
                  ]}
                />
              </div>
            )}

            {hasFeature('custom_thumbnail') && (
              <div style={{ marginTop: '24px' }}>
                <ImagePicker
                  label={t('dashboard.edit.customThumbnail')}
                  value={thumbnailFile}
                  onChange={setThumbnailFile}
                />
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.edit.directLink')}</label>
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
                    alert(t('dashboard.edit.linkCopied'));
                  }}
                  style={{ padding: '0 16px', background: 'var(--gradient-brand)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {t('dashboard.edit.copyLink')}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>{t('dashboard.edit.embedCode')}</label>
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
                    alert(t('dashboard.edit.codeCopied'));
                  }}
                  style={{ padding: '0 16px', background: 'var(--gradient-brand)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  {t('dashboard.edit.copyCode')}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveVideoEdit} disabled={isSaving || isUploadingThumbnail}>
                {isSaving || isUploadingThumbnail ? t('common.saving') : t('dashboard.settings.profile.save')}
              </button>
              <button onClick={() => { setEditingVideo(null); setThumbnailFile(null); }} style={{ padding: '16px 24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
              <button onClick={deleteVideo} disabled={isSaving} style={{ width: '100%', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
                {t('dashboard.edit.deleteVideo')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div role="dialog" aria-modal="true" aria-label={t('dashboard.upload.title')} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '40px', position: 'relative' }}>
            {!isUploading && (
              <button
                onClick={() => { setIsUploadOpen(false); setUploadFile(null); }}
                style={{ position: 'absolute', top: '16px', right: i18n.dir() === 'rtl' ? 'auto' : '16px', left: i18n.dir() === 'rtl' ? '16px' : 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            )}
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '32px' }}>{t('dashboard.upload.title')}</h2>

            {!isUploading && !uploadFile && (
              <div className="dropzone" onClick={() => document.getElementById('file-upload')?.click()}>
                <div className="dropzone-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <input type="file" id="file-upload" style={{ display: 'none' }} accept="video/mp4,video/quicktime" onChange={handleFileSelect} />
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>{t('dashboard.upload.dropzone')}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{t('dashboard.upload.supported')}</div>
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
                    <button className="btn-primary" style={{ flex: 1 }} onClick={startUpload}>{t('dashboard.upload.startUpload')}</button>
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
          token={null}
          onClose={() => setPlayingVideo(null)}
          primaryColor={(user?.tenant as any)?.primary_color || '#4f46e5'}
        />
      )}
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
    </>
  );
}
