import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../context/TenantContext';
import { BOOKING_DESKTOP_MIN_WIDTH, useMediaQuery } from '../../hooks/useMediaQuery';
import { scrollBookingFlowToTop, usePublicBookingFlow } from '../../hooks/usePublicBookingFlow';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import BookingPreviewServiceStep from './BookingPreviewServiceStep';
import BookingPreviewBarberStep from './BookingPreviewBarberStep';
import BookingPreviewDateTimeStep from './BookingPreviewDateTimeStep';
import BookingPreviewSummaryStep from './BookingPreviewSummaryStep';
import PublicBookingPreviewDesktop from './PublicBookingPreviewDesktop';
import BookingPreviewSuccessStep from './BookingPreviewSuccessStep';
import './booking-preview.css';
import './booking-preview-v2.css';
import './booking-preview-desktop.css';

function scrollEmbedBookingFlowToTop() {
  if (typeof document === 'undefined') return;
  document
    .querySelector('.lt-phone__embed .booking-preview--v2 .bp-flow__scroll')
    ?.scrollTo({ top: 0, behavior: 'auto' });
}

export default function PublicBookingPreview({
  showPreviewBanner = true,
  forceMobile = false,
  embedMode = false,
  portalUrl: portalUrlProp,
  onOpenPortal,
  loginRequestBump = 0,
}) {
  const { slug } = useTenant();
  const navigate = useNavigate();
  const flow = usePublicBookingFlow();
  const isWideScreen = useMediaQuery(BOOKING_DESKTOP_MIN_WIDTH);
  const isDesktop = !forceMobile && isWideScreen;
  const officialUrl = `/${slug}`;
  const portalUrl = portalUrlProp || `/${slug}/portal`;
  const openPortal = onOpenPortal
    || (embedMode
      ? () => window.open(portalUrl, '_blank', 'noopener,noreferrer')
      : () => navigate(portalUrl));

  useEffect(() => {
    loadGoogleIdentityScript();
  }, []);

  const {
    step,
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
    isSubmitting,
    bookingError,
    authMode,
    setAuthMode,
    authData,
    setAuthData,
    authError,
    setAuthError,
    authInfo,
    googleBusy,
    forgotBusy,
    openForgotPassword,
    services,
    activeBarbers,
    currentCustomer,
    allWorkingDayIsosInHorizon,
    goToStep,
    pickService,
    confirmServiceStep,
    pickBarber,
    confirmBarberStep,
    pickDate,
    pickTime,
    confirmDateTimeStep,
    resetBooking,
    handleFinishBooking,
    handleAuthSubmit,
    handleGoogleCustomerLogin,
    getSlotsForDay,
  } = flow;

  useEffect(() => {
    if (isDesktop) return;
    if (embedMode) scrollEmbedBookingFlowToTop();
    else scrollBookingFlowToTop();
  }, [step, isDesktop, embedMode]);

  useEffect(() => {
    if (!loginRequestBump) return;
    if (isDesktop) return;
    goToStep(4);
    if (embedMode) scrollEmbedBookingFlowToTop();
    else scrollBookingFlowToTop();
  }, [loginRequestBump, isDesktop, goToStep, embedMode]);

  const previewBanner = showPreviewBanner ? (
    <div className="booking-preview__banner">
      <span className="booking-preview__badge">Versão de teste</span>
      <span>Visual novo em avaliação.</span>
      <Link to={officialUrl}>Oficial</Link>
    </div>
  ) : null;

  const wrapClass = [
    'booking-preview',
    'booking-preview--v2',
    isDesktop ? 'booking-preview--desktop' : '',
    embedMode ? 'booking-preview--embed' : '',
  ].filter(Boolean).join(' ');

  if (step === 5) {
    return (
      <div className={wrapClass}>
        <BookingPreviewSuccessStep
          selectedService={selectedService}
          selectedBarber={selectedBarber}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onNewBooking={resetBooking}
          onOpenPortal={openPortal}
        />
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className={wrapClass}>
        <PublicBookingPreviewDesktop
          flow={flow}
          previewBanner={previewBanner}
          loginRequestBump={loginRequestBump}
        />
      </div>
    );
  }

  const wrap = (content) => <div className={wrapClass}>{content}</div>;

  if (step === 1) {
    return wrap(
      <BookingPreviewServiceStep
        services={services}
        selectedService={selectedService}
        onPickService={pickService}
        onContinue={confirmServiceStep}
        previewBanner={previewBanner}
      />,
    );
  }

  if (step === 2) {
    return wrap(
      <BookingPreviewBarberStep
        barbers={activeBarbers}
        selectedBarber={selectedBarber}
        onPickBarber={pickBarber}
        onBack={() => goToStep(1)}
        onContinue={confirmBarberStep}
        previewBanner={previewBanner}
      />,
    );
  }

  if (step === 3) {
    return wrap(
      <BookingPreviewDateTimeStep
        workingDayIsos={allWorkingDayIsosInHorizon}
        selectedBarber={selectedBarber}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onPickDate={pickDate}
        onPickTime={pickTime}
        onBack={() => goToStep(2)}
        onContinue={confirmDateTimeStep}
        getSlotsForDay={getSlotsForDay}
        previewBanner={previewBanner}
      />,
    );
  }

  if (step === 4) {
    return wrap(
      <BookingPreviewSummaryStep
        services={services}
        selectedService={selectedService}
        selectedBarber={selectedBarber}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        currentCustomer={currentCustomer}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authData={authData}
        setAuthData={setAuthData}
        authError={authError}
        authInfo={authInfo}
        googleBusy={googleBusy}
        forgotBusy={forgotBusy}
        openForgotPassword={openForgotPassword}
        bookingError={bookingError}
        isSubmitting={isSubmitting}
        onAuthSubmit={handleAuthSubmit}
        onGoogleLogin={handleGoogleCustomerLogin}
        onBack={() => goToStep(3)}
        onConfirm={handleFinishBooking}
        onEditStep={goToStep}
        previewBanner={previewBanner}
      />,
    );
  }

  return null;
}
