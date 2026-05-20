import React from 'react';
import loginBackground from '../../assets/customer-login-bg.png';
import '../../pages/preview/login-preview.css';

export default function LoginScreenLayout({ banner, children }) {
  return (
    <div className="login-preview">
      <img
        className="login-preview__bg"
        src={loginBackground}
        alt=""
        aria-hidden
      />
      {banner}
      <main className="login-preview__stage">{children}</main>
    </div>
  );
}
