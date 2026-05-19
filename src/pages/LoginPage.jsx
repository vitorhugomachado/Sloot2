import React, { useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext';

const LoginPage = ({ onLogin }) => {
  const { businessInfo } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onLogin(email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="staff-login-page">
      <section className="staff-login-side-art" aria-hidden="true">
        <div className="staff-login-stripes"></div>
      </section>

      <section className="staff-login-panel">
        <div className="staff-login-card fade-in">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            {businessInfo?.logo_url ? (
              <img src={businessInfo.logo_url} alt="Logo" style={{ maxHeight: '72px', maxWidth: '100%', marginBottom: '1rem', borderRadius: '10px' }} />
            ) : null}
            <div style={{ marginBottom: '0.4rem' }}>
              <span className="sloot-logo-text staff-login-brand" aria-label="SLOOT">
                <span className="staff-login-letter">S</span>
                <span className="staff-login-letter">L</span>
                <span className="staff-login-letter">O</span>
                <span className="staff-login-letter">O</span>
                <span className="staff-login-letter">T</span>
              </span>
            </div>
            <h1 className="staff-login-title" aria-label="Bem vindo!">
              <span className="staff-login-title-letter">B</span>
              <span className="staff-login-title-letter">e</span>
              <span className="staff-login-title-letter">m</span>
              <span className="staff-login-title-letter">&nbsp;</span>
              <span className="staff-login-title-letter">v</span>
              <span className="staff-login-title-letter">i</span>
              <span className="staff-login-title-letter">n</span>
              <span className="staff-login-title-letter">d</span>
              <span className="staff-login-title-letter">o</span>
              <span className="staff-login-title-letter">!</span>
            </h1>
            <p className="staff-login-subtitle">Acesso para barbeiros e profissionais da barbearia.</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Mail size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="email"
                required
                className="staff-login-input"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="password"
                required
                className="staff-login-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <svg className="staff-login-goo-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <defs>
                <filter id="staff-login-goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                    result="goo"
                  />
                  <feBlend in="SourceGraphic" in2="goo" />
                </filter>
              </defs>
            </svg>

            <button type="submit" className="blob-btn staff-login-submit" disabled={isSubmitting}>
              <span className="blob-btn__inner">
                <span className="blob-btn__blobs">
                  <span className="blob-btn__blob" />
                  <span className="blob-btn__blob" />
                  <span className="blob-btn__blob" />
                  <span className="blob-btn__blob" />
                </span>
              </span>
              <span className="blob-btn__label">
                {isSubmitting ? 'Entrando...' : 'Sign in'}
                <ArrowRight size={16} aria-hidden />
              </span>
            </button>
          </form>

        </div>
      </section>
    </div>
  );
};

export default LoginPage;
