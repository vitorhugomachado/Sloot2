import React from 'react';
import '../../pages/preview/login-preview.css';

export default function LoginScreenLayout({ banner, children }) {
  return (
    <div className="login-preview">
      <div
        className="login-preview__bg w-full h-screen bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/fundo.webp')",
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
