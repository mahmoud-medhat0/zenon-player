import { useState, FormEvent } from 'react';
import { router } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import LanguageSwitcher from '../../components/LanguageSwitcher';

export default function Login() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleAuth = (e: FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    if (isLogin) {
      axios.post('/login', { email, password })
        .then((response) => {
          router.visit('/');
        })
        .catch((error) => {
          if (error.response?.data?.errors) {
            const errs = error.response.data.errors;
            setAuthError(errs.email?.[0] || errs.password?.[0] || t('auth.authFailed'));
          } else if (error.response?.data?.message) {
            setAuthError(error.response.data.message);
          } else {
            setAuthError(t('auth.authFailed'));
          }
          setIsAuthLoading(false);
        });
    } else {
      axios.post('/register', { name, email, password, tenant_name: tenantName })
        .then(() => {
          router.visit('/');
        })
        .catch((error) => {
          if (error.response?.data?.errors) {
            const errs = error.response.data.errors;
            setAuthError(
              errs.email?.[0] ||
              errs.password?.[0] ||
              errs.name?.[0] ||
              errs.tenant_name?.[0] ||
              t('auth.authFailed')
            );
          } else if (error.response?.data?.message) {
            setAuthError(error.response.data.message);
          } else {
            setAuthError(t('auth.authFailed'));
          }
          setIsAuthLoading(false);
        });
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="auth-language-switcher">
        <LanguageSwitcher />
      </div>
      <div className="auth-hero">
        <div className="auth-hero-content">
          <div className="logo" style={{ fontSize: '36px', marginBottom: '24px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gradient">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {t('common.appName')}
          </div>
          <h1 style={{ fontSize: '56px', fontWeight: 800, lineHeight: 1.1, marginBottom: '24px' }}>
            {t('auth.heroTitle')} <span className="text-gradient">{t('auth.heroGradient')}</span>.
          </h1>
          <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            {t('auth.heroDesc')}
          </p>
        </div>
      </div>

      <div className="auth-form-wrapper">
        <div className="auth-card animate-fade-in">
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
            {isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
            {isLogin ? t('auth.welcomeDesc') : t('auth.createDesc')}
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
                  <input type="text" className="input-field" placeholder={t('auth.fullName')} value={name} onChange={e => setName(e.target.value)} required />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div className="input-group">
                  <input type="text" className="input-field" placeholder={t('auth.workspaceName')} value={tenantName} onChange={e => setTenantName(e.target.value)} required />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
              </>
            )}
            <div className="input-group">
              <input type="email" className="input-field" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required />
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <div className="input-group">
              <input type="password" className="input-field" placeholder={t('auth.password')} value={password} onChange={e => setPassword(e.target.value)} required />
              <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>

            <button type="submit" className="btn-primary" disabled={isAuthLoading} style={{ marginTop: '32px' }}>
              {isAuthLoading ? (
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
              ) : (
                isLogin ? t('auth.signIn') : t('auth.signUp')
              )}
            </button>
          </form>

          <div style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            <button onClick={() => setIsLogin(!isLogin)} style={{ background: 'none', border: 'none', color: 'var(--primary-hover)', fontWeight: 600, cursor: 'pointer', fontSize: '15px' }}>
              {isLogin ? t('auth.createOne') : t('auth.signInLink')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
