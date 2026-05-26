import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Scissors,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import BookingPreviewStepper from './BookingPreviewStepper';
import { AuthLoginCard } from './BookingPreviewAuth';
import {
  formatDateChip,
  formatDuration,
  formatPrice,
  formatSummaryDate,
  getDesktopStepperStep,
} from './bookingPreviewFormatters';
import BookingPreviewSummaryRow, { getServiceSummaryVisual } from './BookingPreviewSummaryRow';

const SERVICE_ICONS = [Scissors, Sparkles, User];

function CarouselNav({ trackRef }) {
  const scroll = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.75, 220), behavior: 'smooth' });
  };

  return (
    <>
      <button type="button" className="bp-desk-carousel__nav bp-desk-carousel__nav--prev" onClick={() => scroll(-1)} aria-label="Anterior">
        <ChevronLeft size={22} strokeWidth={2.5} />
      </button>
      <button type="button" className="bp-desk-carousel__nav bp-desk-carousel__nav--next" onClick={() => scroll(1)} aria-label="Próximo">
        <ChevronRight size={22} strokeWidth={2.5} />
      </button>
    </>
  );
}

export default function PublicBookingPreviewDesktop({ flow, previewBanner, loginRequestBump = 0 }) {
  const {
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
    services,
    activeBarbers,
    allWorkingDayIsosInHorizon,
    pickService,
    pickBarber,
    pickDate,
    pickTime,
    getSlotsForDay,
    currentCustomer,
    authMode,
    setAuthMode,
    authData,
    setAuthData,
    authError,
    authInfo,
    googleBusy,
    forgotBusy,
    openForgotPassword,
    bookingError,
    isSubmitting,
    handleAuthSubmit,
    handleGoogleCustomerLogin,
    handleFinishBooking,
  } = flow;

  const serviceTrackRef = useRef(null);
  const barberTrackRef = useRef(null);
  const dateTrackRef = useRef(null);
  const [showAuthCard, setShowAuthCard] = useState(false);
  const pendingConfirmRef = useRef(false);

  const stepperStep = getDesktopStepperStep({
    selectedService,
    selectedBarber,
    selectedDate,
    selectedTime,
  });

  const dateFmt = formatSummaryDate(selectedDate);
  const { slotsToDisplay, isWithinAnyShift, taken } = selectedDate
    ? getSlotsForDay(selectedDate)
    : { slotsToDisplay: [], isWithinAnyShift: () => false, taken: new Set() };

  const needsBarber = !selectedBarber;
  const barberLabel = selectedBarber?.name || '—';
  const serviceSub = selectedService
    ? `${formatDuration(selectedService.duration)} • ${formatPrice(selectedService.price)}`
    : '';
  const serviceVisual = getServiceSummaryVisual(services, selectedService);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeAuthCard = () => {
    setShowAuthCard(false);
    pendingConfirmRef.current = false;
  };

  const handleConfirmClick = () => {
    if (isSubmitting) return;
    if (!selectedService || !selectedBarber || !selectedDate || !selectedTime) {
      return;
    }
    if (currentCustomer) {
      handleFinishBooking();
      return;
    }
    pendingConfirmRef.current = true;
    setShowAuthCard(true);
  };

  useEffect(() => {
    if (!currentCustomer || !pendingConfirmRef.current) return;
    pendingConfirmRef.current = false;
    setShowAuthCard(false);
    handleFinishBooking();
  }, [currentCustomer, handleFinishBooking]);

  useEffect(() => {
    if (!loginRequestBump) return;
    setShowAuthCard(true);
    pendingConfirmRef.current = false;
  }, [loginRequestBump]);

  useEffect(() => {
    if (!showAuthCard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAuthCard]);

  useEffect(() => {
    if (!selectedBarber) return;
    if (allWorkingDayIsosInHorizon.length === 0) return;
    if (!allWorkingDayIsosInHorizon.includes(selectedDate)) {
      pickDate(allWorkingDayIsosInHorizon[0]);
    }
  }, [selectedBarber, allWorkingDayIsosInHorizon, selectedDate, pickDate]);

  const canConfirm =
    selectedService &&
    selectedBarber &&
    selectedDate &&
    selectedTime &&
    !isSubmitting;

  return (
    <div className="bp-desk">
      {previewBanner}

      <div className="bp-desk__card">
        <header className="bp-desk__stepper-wrap">
          <BookingPreviewStepper current={stepperStep} />
        </header>

        <div className="bp-desk__grid">
          <div className="bp-desk__main">
            <section id="bp-desktop-section-1" className="bp-desk-section">
              <h2 className="bp-desk-section__title">1. Escolha o serviço</h2>
              <div className="bp-desk-carousel">
                <CarouselNav trackRef={serviceTrackRef} />
                <div ref={serviceTrackRef} className="bp-desk-carousel__track" role="list">
                  {services.length === 0 ? (
                    <p className="bp-empty">Nenhum serviço disponível.</p>
                  ) : (
                    services.map((s, index) => {
                      const Icon = SERVICE_ICONS[index % SERVICE_ICONS.length];
                      const selected = selectedService?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          role="listitem"
                          className={`bp-desk-pick-card${selected ? ' bp-desk-pick-card--selected' : ''}`}
                          onClick={() => pickService(s)}
                        >
                          <span className="bp-desk-pick-card__icon">
                            <Icon size={22} strokeWidth={1.75} aria-hidden />
                          </span>
                          <span className="bp-desk-pick-card__name">{s.name}</span>
                          <span className="bp-desk-pick-card__meta">{formatDuration(s.duration)}</span>
                          <span className="bp-desk-pick-card__price">{formatPrice(s.price)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section id="bp-desktop-section-2" className="bp-desk-section">
              <h2 className="bp-desk-section__title">2. Escolha o profissional</h2>
              <div className="bp-desk-carousel">
                <CarouselNav trackRef={barberTrackRef} />
                <div ref={barberTrackRef} className="bp-desk-carousel__track" role="list">
                  {activeBarbers.map((b) => {
                    const selected = selectedBarber?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        role="listitem"
                        className={`bp-desk-pro-card${selected ? ' bp-desk-pick-card--selected' : ''}`}
                        onClick={() => pickBarber(b)}
                      >
                        <span className="bp-desk-pro-card__avatar">
                          {b.foto_perfil ? (
                            <img src={b.foto_perfil} alt="" />
                          ) : (
                            <span>{b.name.charAt(0)}</span>
                          )}
                        </span>
                        <span className="bp-desk-pro-card__name">{b.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <div id="bp-desktop-datetime" className="bp-desk-datetime-row">
            <section id="bp-desktop-section-3" className="bp-desk-section bp-desk-section--datetime">
              <h2 className="bp-desk-section__title">3. Escolha a data</h2>
              <div className="bp-desk-carousel bp-desk-carousel--dates">
                <CarouselNav trackRef={dateTrackRef} />
                <div ref={dateTrackRef} className="bp-desk-carousel__track bp-desk-carousel__track--dates">
                  {needsBarber ? (
                    <p className="bp-empty bp-empty--inline">Selecione seu profissional</p>
                  ) : allWorkingDayIsosInHorizon.length === 0 ? (
                    <p className="bp-empty bp-empty--inline">Sem dias com expediente.</p>
                  ) : (
                    allWorkingDayIsosInHorizon.map((iso) => {
                      const chip = formatDateChip(iso);
                      const selected = selectedDate === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          className={`bp-desk-date-chip${selected ? ' bp-desk-date-chip--selected' : ''}`}
                          onClick={() => pickDate(iso)}
                        >
                          <span className="bp-desk-date-chip__wd">{chip.weekday}</span>
                          <span className="bp-desk-date-chip__day">{chip.day}</span>
                          <span className="bp-desk-date-chip__mo">{chip.month}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section id="bp-desktop-section-4" className="bp-desk-section bp-desk-section--datetime">
              <h2 className="bp-desk-section__title">4. Escolha o horário</h2>
              {needsBarber ? (
                <p className="bp-empty bp-empty--inline">Selecione seu profissional</p>
              ) : !selectedDate ? (
                <p className="bp-empty bp-empty--inline">Selecione uma data ao lado.</p>
              ) : slotsToDisplay.length === 0 ? (
                <p className="bp-empty bp-empty--inline">Nenhum horário neste dia.</p>
              ) : (
                <div className="bp-desk-time-grid">
                  {slotsToDisplay.map((t) => {
                    const ok = isWithinAnyShift(t) && !taken.has(t);
                    const selected = selectedTime === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className={[
                          'bp-desk-time-slot',
                          ok && 'bp-desk-time-slot--ok',
                          selected && 'bp-desk-time-slot--selected',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={!ok}
                        onClick={() => ok && pickTime(t)}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
            </div>
          </div>

          <aside className="bp-desk__aside">
            <h2 className="bp-desk-aside__title">5. Resumo do agendamento</h2>
            <div className="bp-desk-aside__sticky">
              <div className="bp-summary-card">
                <BookingPreviewSummaryRow
                  icon={serviceVisual.icon}
                  imageSrc={serviceVisual.imageSrc}
                  imageAlt={selectedService?.name}
                  iconVariant="purple"
                  label="Serviço"
                  value={selectedService?.name || '—'}
                  sub={serviceSub || undefined}
                  onEdit={() => scrollToSection('bp-desktop-section-1')}
                />
                <BookingPreviewSummaryRow
                  icon={User}
                  imageSrc={selectedBarber?.foto_perfil}
                  imageAlt={selectedBarber?.name}
                  fallbackInitial={selectedBarber?.name?.charAt(0)}
                  iconVariant="mint"
                  label="Profissional"
                  value={barberLabel}
                  onEdit={() => scrollToSection('bp-desktop-section-2')}
                />
                <BookingPreviewSummaryRow
                  icon={Calendar}
                  iconVariant="purple"
                  label="Data"
                  value={dateFmt.line}
                  sub={dateFmt.sub}
                  onEdit={() => scrollToSection('bp-desktop-datetime')}
                />
                <BookingPreviewSummaryRow
                  icon={Clock}
                  iconVariant="mint"
                  label="Horário"
                  value={selectedTime || '—'}
                  onEdit={() => scrollToSection('bp-desktop-section-4')}
                />
              </div>

              {bookingError && !showAuthCard && <p className="bp-error">{bookingError}</p>}

              <div className="bp-security-banner" role="status">
                <span className="bp-security-banner__icon" aria-hidden>
                  <ShieldCheck size={20} strokeWidth={2} />
                </span>
                <span>Seus dados estão protegidos e seguros.</span>
              </div>

              <button
                type="button"
                className="bp-btn-continuar bp-btn-continuar--summary"
                disabled={!canConfirm}
                onClick={handleConfirmClick}
              >
                {isSubmitting ? 'Confirmando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {showAuthCard && !currentCustomer && (
        <div className="bp-auth-overlay bp-auth-overlay--desktop-center" onClick={closeAuthCard} role="presentation">
          <div className="bp-auth-overlay__sheet bp-auth-overlay__sheet--center" onClick={(e) => e.stopPropagation()}>
            <AuthLoginCard
              authMode={authMode}
              setAuthMode={setAuthMode}
              authData={authData}
              setAuthData={setAuthData}
              authError={authError}
              authInfo={authInfo}
              googleBusy={googleBusy}
              forgotBusy={forgotBusy}
              openForgotPassword={openForgotPassword}
              onAuthSubmit={handleAuthSubmit}
              onGoogleLogin={handleGoogleCustomerLogin}
              onClose={closeAuthCard}
            />
          </div>
        </div>
      )}
    </div>
  );
}
