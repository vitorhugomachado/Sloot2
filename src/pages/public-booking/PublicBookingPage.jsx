import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import PublicBookingCustomerHeader from './PublicBookingCustomerHeader';
import PublicBookingPreview from '../preview/PublicBookingPreview';
import CustomerPortalLoginModal from './CustomerPortalLoginModal';
import '../../components/business/business-hero-header.css';
import './public-booking-customer-header.css';

export default function PublicBookingPage() {
  const { slug } = useTenant();
  const { isCustomerAuthenticated } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPortalLogin, setShowPortalLogin] = useState(false);

  const portalUrl = `/${slug}/cliente/portal`;

  const openPortal = useCallback(() => {
    if (isCustomerAuthenticated) {
      navigate(portalUrl);
    } else {
      setShowPortalLogin(true);
    }
  }, [isCustomerAuthenticated, navigate, portalUrl]);

  const handleRequestLogin = useCallback(() => {
    setShowPortalLogin(true);
  }, []);

  const handlePortalLoginSuccess = useCallback((user) => {
    setShowPortalLogin(false);
    navigate(portalUrl, { replace: true, state: { customer: user } });
  }, [navigate, portalUrl]);

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  useEffect(() => {
    if (!location.state?.portalLogin) return;
    setShowPortalLogin(true);
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.portalLogin, location.pathname, navigate]);

  return (
    <div className="public-booking-page public-booking-page--v2">
      <PublicBookingCustomerHeader onOpenPortal={openPortal} onRequestLogin={handleRequestLogin} />
      <PublicBookingPreview
        showPreviewBanner={false}
        portalUrl={portalUrl}
        onOpenPortal={openPortal}
      />
      {showPortalLogin && (
        <CustomerPortalLoginModal
          onClose={() => setShowPortalLogin(false)}
          onSuccess={handlePortalLoginSuccess}
        />
      )}
    </div>
  );
}
