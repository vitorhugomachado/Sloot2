import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AuthLoginCard } from '../preview/BookingPreviewAuth';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import '../preview/booking-preview-v2.css';

export default function CustomerPortalLoginModal({ onClose, onSuccess }) {
  const auth = useCustomerAuth({ onSuccess });

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const modal = (
    <div
      className="bp-auth-overlay bp-auth-overlay--portal bp-auth-overlay--desktop-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bp-auth-overlay__sheet bp-auth-overlay__sheet--center"
        onClick={(e) => e.stopPropagation()}
      >
        <AuthLoginCard
          {...auth}
          onAuthSubmit={auth.onAuthSubmit}
          onGoogleLogin={auth.onGoogleLogin}
          onClose={onClose}
          title="Entrar na sua conta"
          subtitle="Acesse sua agenda, histórico e dados do perfil."
        />
      </div>
    </div>
  );

  if (typeof document === 'undefined') return modal;
  return createPortal(modal, document.body);
}
