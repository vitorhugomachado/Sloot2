import React from 'react';
import SlootiLogo from '../SlootiLogo';
import './login-screen.css';

const CUSTOMER_BG = '/fundo.webp';

export default function LoginScreenLayout({
  banner,
  children,
  variant = 'default',
  brandTagline = 'Barbeiros',
}) {
  const isStaff = variant === 'staff';

  return (
    <div className={`login-preview ${isStaff ? 'login-preview--staff' : ''}`}>
      {!isStaff ? (
        <div
          className="login-preview__bg w-full h-screen bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('${CUSTOMER_BG}')`,
            imageRendering: '-webkit-optimize-contrast',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
          }}
          aria-hidden
        />
      ) : null}
      {banner}
      <main className="login-preview__stage">
        {isStaff ? (
          <div className="login-preview__stack">
            <div className="login-preview__brand">
              <SlootiLogo size="xl" onDark />
              <p className="login-preview__brand-tagline">{brandTagline}</p>
            </div>
            {children}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
