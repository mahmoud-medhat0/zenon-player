import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { confirmDelete, showSuccess, showError } from '../utils/alerts';
import VideoPlayer from '../components/VideoPlayer';
import AdminSelect from '../components/AdminSelect';
import { X } from 'lucide-react';
import ImagePicker from '../components/ImagePicker';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-dt';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../layouts/DashboardLayout';

DataTable.use(DT);

export default function Library() {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const { t, i18n } = useTranslation();

  // Videos State
  const [videos, setVideos] = useState<any[]>([]);
  const [processingCount, setProcessingCount] = useState(0);
  const [tableApi, setTableApi] = useState<any>(null);

  // Edit Video State
  const [editingVideo, setEditingVideo] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrivacy, setEditPrivacy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  // Video Player State
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingVideo) setEditingVideo(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingVideo]);

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

      if (tableApi) {
        tableApi.ajax.reload(null, false);
      }
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
      if (tableApi) {
        tableApi.ajax.reload(null, false);
      }
      setEditingVideo(null);
      showSuccess(t('dashboard.toasts.videoDeleted'));
    } catch (err) {
      showError(t('dashboard.toasts.videoDeleteFailed'));
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleTableClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest('[data-action]');
      if (!target) return;
      
      const action = target.getAttribute('data-action');
      const videoId = target.getAttribute('data-id');
      if (!videoId) return;

      const video = videos.find(v => v.id === videoId);
      if (!video) return;

      if (action === 'edit') {
        setEditingVideo(video);
        setEditTitle(video.title);
        setEditPrivacy(video.privacy || 'private');
      } else if (action === 'play') {
        if (video.status === 'ready') setPlayingVideo(video.id);
      } else if (action === 'delete') {
        confirmDelete(
          t('dashboard.library.table.deleteTitle', 'Delete Video'),
          t('dashboard.library.table.deleteMsg', 'Are you sure you want to delete this video?')
        ).then((isConfirmed) => {
          if (isConfirmed) {
            axios.delete(`/api/videos/${videoId}`)
              .then(() => {
                showSuccess(t('dashboard.toasts.videoDeleted'));
                if (tableApi) tableApi.ajax.reload(null, false);
              })
              .catch(err => {
                showError(t('dashboard.toasts.videoDeleteFailed'));
                console.error(err);
              });
          }
        });
      } else if (action === 'copy') {
        navigator.clipboard.writeText(`${window.location.origin}/embed/${videoId}`);
        showSuccess(t('dashboard.edit.linkCopied', 'Link copied to clipboard'));
      }
    };
    
    document.addEventListener('click', handleTableClick);
    return () => document.removeEventListener('click', handleTableClick);
  }, [videos, tableApi, t]);

  useEffect(() => {
    let interval: any;

    const pollVideos = async () => {
      try {
        if (tableApi) {
          tableApi.ajax.reload(null, false);
          const res = await axios.get('/api/videos', { params: { draw: 1, length: 1 } });
          if (res.data.processing_count !== undefined) {
            setProcessingCount(res.data.processing_count);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (processingCount > 0) {
      interval = setInterval(pollVideos, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [processingCount, tableApi]);

  const dtColumns = [
    { 
      data: 'title', 
      title: t('dashboard.library.table.video', 'Video'),
      width: '40%',
      render: (data: any, type: any, row: any) => `
        <div style="display: flex; align-items: center; gap: 16px; cursor: pointer" data-action="play" data-id="${row.id}">
          <div style="width: 120px; height: 68px; border-radius: 8px; overflow: hidden; background: #000; position: relative; flex-shrink: 0">
            ${row.thumbnail 
              ? `<img src="${row.thumbnail}" alt="" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8" />` 
              : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.2)">
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                 </div>`
            }
            ${row.status === 'ready' && row.duration ? `<div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.8); padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: 600; font-variant-numeric: tabular-nums">${row.duration}</div>` : ''}
          </div>
          <div style="min-width: 0; text-align: left;">
            <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 4px 0; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${row.title}</h3>
            <p style="font-size: 12px; color: rgba(255,255,255,0.5); margin: 0">${row.id.substring(0, 8)}...</p>
          </div>
        </div>
      `
    },
    {
      data: 'status',
      title: t('dashboard.library.table.status', 'Status'),
      width: '15%',
      render: (data: any) => {
        if (data === 'ready') return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2)"><span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981"></span> ${t('dashboard.library.ready', 'Ready')}</span>`;
        if (data === 'processing') return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; background: rgba(99, 102, 241, 0.1); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.2)"><span style="width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"></span> ${t('dashboard.library.processing', 'Processing')}</span>`;
        return `<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2)"><span style="width: 6px; height: 6px; border-radius: 50%; background: #ef4444"></span> ${t('dashboard.library.failed', 'Failed')}</span>`;
      }
    },
    { data: 'duration', title: t('dashboard.library.table.duration', 'Duration'), width: '10%' },
    { data: 'views', title: t('dashboard.library.table.views', 'Views'), width: '10%' },
    { data: 'date', title: t('dashboard.library.table.date', 'Date'), width: '15%' },
    {
      data: 'id',
      title: t('dashboard.library.table.actions', 'Actions'),
      orderable: false,
      width: '10%',
      render: (data: any, type: any, row: any) => `
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px">
          ${row.status === 'ready' ? `<button data-action="copy" data-id="${row.id}" style="padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #fff; cursor: pointer" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>` : ''}
          <button data-action="edit" data-id="${row.id}" style="padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: #fff; cursor: pointer" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
          <button data-action="delete" data-id="${row.id}" style="padding: 8px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.1); color: #ef4444; cursor: pointer" onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
        </div>
      `
    }
  ];

  return (
    <DashboardLayout activeTab="library">
      <div className="page-header">
        <div>
          <h1 className="section-title">{t('dashboard.library.title')}</h1>
          <p className="section-subtitle">{t('dashboard.library.subtitle')}</p>
        </div>
      </div>
      
      {processingCount > 0 && (
        <div style={{ padding: '16px 24px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--primary)', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
            {processingCount} video{processingCount !== 1 ? 's' : ''} currently importing or processing in the background...
          </span>
        </div>
      )}

      <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid var(--border-color)', padding: '24px' }}>
        <DataTable
          ajax={async (data: any, callback: any) => {
            try {
              const params = new URLSearchParams();
              params.append('draw', data.draw);
              params.append('start', data.start);
              params.append('length', data.length);
              params.append('search[value]', data.search.value || '');
              params.append('search[regex]', data.search.regex ? 'true' : 'false');
              
              if (data.order && data.order.length > 0) {
                params.append('order[0][column]', data.order[0].column);
                params.append('order[0][dir]', data.order[0].dir);
              }

              data.columns.forEach((col: any, index: number) => {
                params.append(`columns[${index}][data]`, col.data);
                params.append(`columns[${index}][name]`, col.name || '');
                params.append(`columns[${index}][searchable]`, col.searchable ? 'true' : 'false');
                params.append(`columns[${index}][orderable]`, col.orderable ? 'true' : 'false');
                params.append(`columns[${index}][search][value]`, col.search.value || '');
                params.append(`columns[${index}][search][regex]`, col.search.regex ? 'true' : 'false');
              });

              const res = await axios.get('/api/videos?' + params.toString());
              
              setVideos(res.data.data);
              if (res.data.processing_count !== undefined) {
                setProcessingCount(res.data.processing_count);
              }

              callback({
                draw: res.data.draw,
                recordsTotal: res.data.recordsTotal,
                recordsFiltered: res.data.recordsFiltered,
                data: res.data.data
              });
            } catch (err) {
              console.error(err);
            }
          }}
          columns={dtColumns}
          options={{
            serverSide: true,
            processing: true,
            searchDelay: 500,
            language: {
              search: t('dashboard.library.table.search', 'Search:'),
              lengthMenu: t('dashboard.library.table.show', 'Show _MENU_ entries'),
              info: t('dashboard.library.table.showing', 'Showing _START_ to _END_ of _TOTAL_ entries'),
              infoEmpty: t('dashboard.library.table.empty', 'Showing 0 to 0 of 0 entries'),
              paginate: {
                previous: t('dashboard.library.table.previous', 'Previous'),
                next: t('dashboard.library.table.next', 'Next')
              }
            }
          }}
          onInit={(api: any) => setTableApi(api)}
          className="vimeo-datatable display w-100"
        />
      </div>

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
                    showSuccess(t('dashboard.edit.linkCopied', 'Link copied'));
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
                    showSuccess(t('dashboard.edit.codeCopied', 'Code copied'));
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

      {/* Player Modal */}
      {playingVideo && (
        <VideoPlayer
          videoId={playingVideo}
          token={null}
          onClose={() => setPlayingVideo(null)}
          primaryColor={(user?.tenant as any)?.primary_color || '#4f46e5'}
        />
      )}
    </DashboardLayout>
  );
}
