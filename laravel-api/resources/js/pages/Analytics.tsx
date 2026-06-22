import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../layouts/DashboardLayout';

export default function Analytics() {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const { t } = useTranslation();

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);

  useEffect(() => {
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
  }, []);

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout activeTab="analytics">
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
    </DashboardLayout>
  );
}
