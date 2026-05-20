import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import PublicBookingCustomerHeader from './PublicBookingCustomerHeader';
import PublicBookingPreview from '../preview/PublicBookingPreview';
import CustomerPortalLoginModal from './CustomerPortalLoginModal';
import './public-booking-customer-header.css';

export default function PublicBookingPage({ onOpenPortal }) {
  const { slug } = useTenant();
  const { currentCustomer } = useApp();
  const navigate = useNavigate();
  const [showPortalLogin, setShowPortalLogin] = useState(false);

  const portalUrl = `/${slug}/cliente/portal`;
  const openPortal = onOpenPortal || (() => navigate(portalUrl));

  const handleRequestLogin = useCallback(() => {
    setShowPortalLogin(true);
  }, []);

  const handlePortalLoginSuccess = useCallback(() => {
    setShowPortalLogin(false);
    openPortal();
  }, [openPortal]);

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  useEffect(() => {
    if (!showPortalLogin || !currentCustomer) return;
    setShowPortalLogin(false);
    openPortal();
  }, [showPortalLogin, currentCustomer, openPortal]);

  return (
    <div className="public-booking-page public-booking-page--v2">
      <PublicBookingCustomerHeader onOpenPortal={openPortal} onRequestLogin={handleRequestLogin} />
      <PublicBookingPreview
        showPreviewBanner={false}
        portalUrl={portalUrl}
        onOpenPortal={openPortal}
      />
      {showPortalLogin && !currentCustomer && (
        <CustomerPortalLoginModal
          onClose={() => setShowPortalLogin(false)}
          onSuccess={handlePortalLoginSuccess}
        />
      )}
    </div>
  );
}
