import { useState, useEffect, FormEvent } from 'react';
import { usePage } from '@inertiajs/react';
import { PageProps } from '../types';
import axios from 'axios';
import { showSuccess, showError } from '../utils/alerts';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../layouts/DashboardLayout';

export default function Team() {
  const { props } = usePage<PageProps>();
  const user = props.auth.user;
  const { t } = useTranslation();

  // Team State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const hasFeature = (key: string) => {
    if (!user || !user.tenant || !user.tenant.plan) return false;
    if (!user.tenant.plan.is_active || !user.tenant.is_active) return false;
    return user.tenant.plan.features?.includes(key) || false;
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
    fetchTeamMembers();
  }, []);

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
    <DashboardLayout activeTab="team">
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
    </DashboardLayout>
  );
}
