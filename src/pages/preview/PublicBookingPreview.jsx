import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { BOOKING_DESKTOP_MIN_WIDTH, useMediaQuery } from '../../hooks/useMediaQuery';
import { scrollBookingFlowToTop, usePublicBookingFlow } from '../../hooks/usePublicBookingFlow';
import { loadGoogleIdentityScript } from '../../utils/loadGoogleIdentity';
import BookingPreviewServiceStep from './BookingPreviewServiceStep';
import BookingPreviewBarberStep from './BookingPreviewBarberStep';
import BookingPreviewDateTimeStep from './BookingPreviewDateTimeStep';
import BookingPreviewSummaryStep from './BookingPreviewSummaryStep';
import PublicBookingPreviewDesktop from './PublicBookingPreviewDesktop';
import './booking-preview.css';
import './booking-preview-v2.css';
import './booking-preview-desktop.css';

export default function PublicBookingPreview({
  showPreviewBanner = true,
  portalUrl: portalUrlProp,
  onOpenPortal,
  loginRequestBump = 0,
}) {
  const { slug } = useTenant();
  const navigate = useNavigate();
  const flow = usePublicBookingFlow();
  const isDesktop = useMediaQuery(BOOKING_DESKTOP_MIN_WIDTH);
  const officialUrl = `/${slug}/cliente`;
  const portalUrl = portalUrlProp || `/${slug}/cliente/portal`;
  const openPortal = onOpenPortal || (() => navigate(portalUrl));

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
    googleBusy,
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
    if (!isDesktop) scrollBookingFlowToTop();
  }, [step, isDesktop]);

  useEffect(() => {
    if (!loginRequestBump) return;
    if (isDesktop) return;
    goToStep(4);
    scrollBookingFlowToTop();
  }, [loginRequestBump, isDesktop, goToStep]);

  const previewBanner = showPreviewBanner ? (
    <div className="booking-preview__banner">
      <span className="booking-preview__badge">Versão de teste</span>
      <span>Visual novo em avaliação.</span>
      <Link to={officialUrl}>Oficial</Link>
    </div>
  ) : null;

  const wrapClass = `booking-preview booking-preview--v2${isDesktop ? ' booking-preview--desktop' : ''}`;

  if (step === 5) {
    return (
      <div className={wrapClass}>
        <section className="bp-success">
          <div className="bp-success__icon">
            <Check size={40} strokeWidth={2.5} />
          </div>
          <h2 className="bp-section-title">Agendamento confirmado!</h2>
          <p className="bp-empty">
            {selectedService?.name} com {selectedBarber?.name}
            <br />
            {selectedDate?.split('-').reverse().join('/')} às {selectedTime}
          </p>
          <div className="bp-success__actions">
            <button type="button" className="bp-btn-continuar" onClick={resetBooking}>
              Novo agendamento
            </button>
            {currentCustomer && (
              <button type="button" className="bp-btn-outline" onClick={openPortal}>
                Meus agendamentos
              </button>
            )}
          </div>
        </section>
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
        googleBusy={googleBusy}
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
