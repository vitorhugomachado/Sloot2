import React from 'react';
import '../../pages/preview/login-preview.css';

const BACKGROUNDS = {
  default: '/fundo.webp',
  staff: '/images/slooti-staff-login-bg.webp',
};

export default function LoginScreenLayout({ banner, children, variant = 'default' }) {
  const isStaff = variant === 'staff';

  return (
    <div className={`login-preview ${isStaff ? 'login-preview--staff' : ''}`}>
      <div
        className="login-preview__bg w-full h-screen bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('${BACKGROUNDS[variant] || BACKGROUNDS.default}')`,
          imageRendering: '-webkit-optimize-contrast',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
        aria-hidden
      />
      {banner}
      <main className="login-preview__stage">{children}</main>
    </div>
  );
}
