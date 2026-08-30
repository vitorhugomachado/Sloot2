import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useTenant } from '../../context/TenantContext';
import { BOOKING_DESKTOP_MIN_WIDTH, useMediaQuery } from '../../hooks/useMediaQuery';
import { usePublicBookingFlow } from '../../hooks/usePublicBookingFlow';
import { resolveBookingPreferences } from '../../utils/bookingPage';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import MobileBookingHub from '../preview/MobileBookingHub';
import { PublicBookingPreviewView } from '../preview/PublicBookingPreview';
import PublicBookingCustomerHeader from './PublicBookingCustomerHeader';
import { tenantPortalPath } from '../../constants/tenantRoutes';
import CustomerPortalLoginModal from './CustomerPortalLoginModal';
import '../../components/business/business-hero-header.css';
import './public-booking-customer-header.css';

export default function PublicBookingPage() {
  const { slug } = useTenant();
  const { isCustomerAuthenticated, features } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPortalLogin, setShowPortalLogin] = useState(() => Boolean(location.state?.portalLogin));
  const [selectionNotice, setSelectionNotice] = useState('');
  const isDesktop = useMediaQuery(BOOKING_DESKTOP_MIN_WIDTH);
  const flow = usePublicBookingFlow();
  const initializedDeepLinkRef = useRef('');

  const portalUrl = tenantPortalPath(slug);
  const mobileHubEnabled = features?.mobileBookingHub !== false;
  const mobileBookingOpen = searchParams.get('agendar') === '1';
  const showHub = !isDesktop && mobileHubEnabled && !mobileBookingOpen;

  const openPortal = useCallback(() => {
    if (isCustomerAuthenticated) navigate(portalUrl);
    else setShowPortalLogin(true);
  }, [isCustomerAuthenticated, navigate, portalUrl]);

  const handleRequestLogin = useCallback(() => setShowPortalLogin(true), []);

  const handlePortalLoginSuccess = useCallback((user) => {
    setShowPortalLogin(false);
    navigate(portalUrl, { replace: true, state: { customer: user } });
  }, [navigate, portalUrl]);

  const cleanHubParams = useCallback((replace = true) => {
    const next = new URLSearchParams(searchParams);
    next.delete('agendar');
    next.delete('servico');
    next.delete('profissional');
    setSearchParams(next, { replace });
  }, [searchParams, setSearchParams]);

  const startBooking = useCallback(({ service, professional } = {}) => {
    setSelectionNotice('');
    flow.clearSelectionWarning();
    if (service) flow.selectServiceAndContinue(service);
    else if (professional) {
      flow.pickBarber(professional);
      flow.goToStep(1);
    } else {
      flow.goToStep(1);
    }

    const next = new URLSearchParams(searchParams);
    next.set('agendar', '1');
    next.delete('servico');
    next.delete('profissional');
    if (service?.id != null) next.set('servico', String(service.id));
    if (professional?.id != null) next.set('profissional', String(professional.id));
    setSearchParams(next);
  }, [flow, searchParams, setSearchParams]);

  const resetToHub = useCallback(() => {
    flow.resetBooking();
    cleanHubParams(true);
  }, [cleanHubParams, flow]);

  const deepLinkKey = useMemo(
    () => `${mobileBookingOpen}:${searchParams.get('servico') || ''}:${searchParams.get('profissional') || ''}`,
    [mobileBookingOpen, searchParams],
  );

  useEffect(() => {
    if (!mobileBookingOpen || initializedDeepLinkRef.current === deepLinkKey) return;
    initializedDeepLinkRef.current = deepLinkKey;
    const preferences = resolveBookingPreferences({
      serviceId: searchParams.get('servico'),
      professionalId: searchParams.get('profissional'),
      services: flow.services,
      professionals: flow.activeBarbers,
    });
    const { service, professional } = preferences;
    if (preferences.warning) {
      window.setTimeout(() => setSelectionNotice(preferences.warning), 0);
      const next = new URLSearchParams(searchParams);
      if (preferences.invalidService) next.delete('servico');
      if (preferences.invalidProfessional) next.delete('profissional');
      setSearchParams(next, { replace: true });
    }
    if (professional) flow.pickBarber(professional);
    if (service) flow.pickService(service);
    if (service && professional) flow.goToStep(3);
    else if (service) flow.goToStep(2);
    else flow.goToStep(1);
  }, [deepLinkKey, flow, mobileBookingOpen, searchParams, setSearchParams]);

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  useEffect(() => {
    if (!location.state?.portalLogin) return;
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.portalLogin, location.pathname, navigate]);

  return (
    <div className={`public-booking-page public-booking-page--v2${mobileHubEnabled ? ' public-booking-page--mobile-hub' : ''}`}>
      {(selectionNotice || flow.selectionWarning) ? (
        <div className="public-booking-page__selection-notice" role="status">
          {selectionNotice || flow.selectionWarning}
        </div>
      ) : null}
      {isDesktop || !mobileHubEnabled ? (
        <PublicBookingCustomerHeader onOpenPortal={openPortal} onRequestLogin={handleRequestLogin} />
      ) : null}

      {showHub ? (
        <MobileBookingHub
          onStartBooking={startBooking}
          onOpenAccount={openPortal}
          accountLabel={isCustomerAuthenticated ? 'Minha agenda' : 'Entrar na conta'}
        />
      ) : (
        <PublicBookingPreviewView
          flow={flow}
          forceMobile={!isDesktop && mobileHubEnabled}
          mobileHubStyle={!isDesktop && mobileHubEnabled}
          showPreviewBanner={false}
          portalUrl={portalUrl}
          onOpenPortal={openPortal}
          onExit={!isDesktop && mobileHubEnabled ? () => cleanHubParams(true) : undefined}
          onNewBooking={!isDesktop && mobileHubEnabled ? resetToHub : undefined}
        />
      )}

      {showPortalLogin && (
        <CustomerPortalLoginModal
          onClose={() => setShowPortalLogin(false)}
          onSuccess={handlePortalLoginSuccess}
        />
      )}
    </div>
  );
}
