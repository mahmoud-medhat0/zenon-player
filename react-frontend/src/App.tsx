import React, { useState, useEffect } from 'react';
import './index.css';
import { useAuth } from './context/AuthContext';
import api from './api/client';
import { confirmDelete, showSuccess, showError } from './utils/alerts';
import VideoPlayer from './components/VideoPlayer';

function App() {
  const { user, login, register, logout, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('library');
  
  // Videos State
  const [videos, setVideos] = useState<any[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);

  // Auth State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Upload State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Edit Video State
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Video Player State
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // User Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const fetchVideos = async () => {
    if (user) {
      try {
        const res = await api.get('/videos');
        setVideos(res.data);
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
        setVideos(res.data);
        setIsLoadingVideos(false);

        const hasProcessing = res.data.some((v: any) => v.status === 'processing');
        if (hasProcessing && !interval) {
          interval = setInterval(async () => {
            try {
              const pollRes = await api.get('/videos');
              setVideos(pollRes.data);
              if (!pollRes.data.some((v: any) => v.status === 'processing')) {
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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isLogin) {
        await login({ email, password });
      } else {
        await register({ name, email, password, tenant_name: tenantName });
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.message || 'Authentication failed');
    } finally {
      setIsAuthLoading(false);
    }
  };

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
        const chunk = uploadFile.slice(start, end);
        
        const formData = new FormData();
        formData.append('chunk', chunk);
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
      await api.put(`/videos/${editingVideo.id}`, { title: editTitle });
      await fetchVideos();
      setEditingVideo(null);
      showSuccess('Changes saved');
    } catch (err) {
      showError('Failed to save changes');
      console.error(err);
    } finally {
      setIsSaving(false);
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

  if (!user) {
    return (
      <div className="auth-container animate-fade-in">
        <div className="auth-hero">
          <div className="auth-hero-content">
            <div className="logo" style={{ fontSize: '36px', marginBottom: '24px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gradient">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Stream
            </div>
            <h1 style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px' }}>
              Host, encode, and deliver <span className="text-gradient">beautiful video</span>.
            </h1>
            <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              The premium enterprise video platform built for modern creators, educators, and brands.
            </p>
          </div>
        </div>
        
        <div className="auth-form-wrapper">
          <div className="auth-card animate-fade-in">
            <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              {isLogin ? 'Enter your details to access your dashboard.' : 'Start delivering stunning video today.'}
            </p>
            
            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                {authError}
              </div>
            )}
            
            <form onSubmit={handleAuth}>
              {!isLogin && (
                <>
                  <div className="input-group">
                    <input type="text" className="input-field" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                    <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </div>
                  <div className="input-group">
                    <input type="text" className="input-field" placeholder="Workspace Name" value={tenantName} onChange={e => setTenantName(e.target.value)} required />
                    <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  </div>
                </>
              )}
              <div className="input-group">
                <input type="email" className="input-field" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              </div>
              <div className="input-group">
                <input type="password" className="input-field" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              
              <button type="submit" className="btn-primary" disabled={isAuthLoading} style={{ marginTop: '32px' }}>
                {isAuthLoading ? (
                  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                ) : (
                  isLogin ? 'Sign In' : 'Sign Up'
                )}
              </button>
            </form>
            
            <div style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: 'var(--primary-hover)', fontWeight: 600, cursor: 'pointer', fontSize: '15px' }}>
                {isLogin ? 'Create one' : 'Sign in'}
              </button>
            </div>
          </div>
        </div>

        {playingVideo && (
          <VideoPlayer
            videoId={playingVideo}
            token={localStorage.getItem('token')}
            onClose={() => setPlayingVideo(null)}
          />
        )}

      </div>
    );
  }

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

        <ul className="nav-menu">
          <li className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Library
          </li>
          <li className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            Analytics
          </li>
          <li className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Settings
          </li>
        </ul>
      </aside>

      <main className="main-content">
        <header className="header">
          <div className="search-container">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" className="search-input" placeholder="Search your library..." />
          </div>
          
          <div className="user-profile">
            <button className="btn-upload" onClick={() => setIsUploadOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              Upload Video
            </button>
            
            <div style={{ position: 'relative' }}>
              <button className="avatar-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                <img src={`https://ui-avatars.com/api/?name=${user.name}&background=4f46e5&color=fff`} alt={user.name} className="avatar-img" />
              </button>
              
              {isDropdownOpen && (
                <div className="glass-panel animate-fade-in" style={{ position: 'absolute', top: '120%', right: '0', width: '220px', borderRadius: '12px', padding: '8px', zIndex: 100 }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 600 }}>{user.name}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user.email}</div>
                  </div>
                  <button onClick={logout} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboard animate-fade-in">
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
                  <img src={video.thumbnail} alt={video.title} className="thumbnail" />
                  <div className="duration" style={{ backgroundColor: video.status === 'failed' ? 'rgba(239, 68, 68, 0.9)' : undefined }}>
                    {video.status === 'ready' ? video.duration : video.status === 'failed' ? 'Failed' : 'Processing...'}
                  </div>
                  <div className="play-overlay" onClick={() => { if(video.status === 'ready') setPlayingVideo(video.id); }}>
                    <div className="play-icon">
                      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                </div>
                <div className="video-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 className="video-title">{video.title}</h3>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEditingVideo(video); setEditTitle(video.title); }}
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
        </div>
      </main>

      {/* Edit Modal */}
      {editingVideo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '40px' }}>
            <h2 style={{ fontSize:'24px', fontWeight: 700, marginBottom: '24px' }}>Edit Video</h2>
            <div className="input-group">
              <input type="text" className="input-field" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ paddingLeft: '16px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn-primary" style={{ flex: 1 }} onClick={saveVideoEdit} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingVideo(null)} style={{ padding: '16px 24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontWeight: 600, cursor: 'pointer' }}>
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
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(8px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:50 }}>
          <div className="auth-card animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '40px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems: 'center', marginBottom:'32px' }}>
              <h2 style={{ fontSize:'24px', fontWeight: 700 }}>Upload Video</h2>
              {!isUploading && (
                <button onClick={() => {setIsUploadOpen(false); setUploadFile(null);}} style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', padding: '8px', borderRadius: '50%', display: 'flex' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>
            
            {!isUploading && !uploadFile && (
              <div className="dropzone" onClick={() => document.getElementById('file-upload')?.click()}>
                <div className="dropzone-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <input type="file" id="file-upload" style={{ display:'none' }} accept="video/mp4,video/quicktime" onChange={handleFileSelect} />
                <div style={{ fontSize: '18px', fontWeight: 600, color:'var(--text-main)', marginBottom: '8px' }}>Click to browse or drag file here</div>
                <div style={{ fontSize: '14px', color:'var(--text-muted)' }}>Supports MP4, MOV up to 10GB</div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize:'14px', marginBottom:'12px', fontWeight: 500 }}>
                      <span style={{ color: 'var(--primary)' }}>{uploadStatus}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.05)', height:'10px', borderRadius:'5px', overflow:'hidden' }}>
                      <div style={{ width:`${uploadProgress}%`, height:'100%', background:'var(--gradient-brand)', transition:'width 0.4s ease' }}></div>
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
        />
      )}
    </>
  );
}

export default App;
