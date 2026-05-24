import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, ShieldCheck, User } from 'lucide-react';
import BookingPreviewStepper from './BookingPreviewStepper';
import BookingPreviewSummaryRow, { getServiceSummaryVisual } from './BookingPreviewSummaryRow';
import { AuthLoginCard } from './BookingPreviewAuth';

function formatSummaryDate(iso) {
  if (!iso) return { line: '—', sub: '' };
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const line = date.toLocaleDateString('pt-BR');
  return { line, sub: cap };
}

function formatPrice(price) {
  const n = Number(price);
  if (Number.isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BookingPreviewSummaryStep({
  services = [],
  selectedService,
  selectedBarber,
  selectedDate,
  selectedTime,
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
  onAuthSubmit,
  onGoogleLogin,
  onBack,
  onConfirm,
  onEditStep,
  previewBanner,
}) {
  const dateFmt = formatSummaryDate(selectedDate);
  const serviceVisual = getServiceSummaryVisual(services, selectedService);
  const [showAuthCard, setShowAuthCard] = useState(false);
  const pendingConfirmRef = useRef(false);

  const closeAuthCard = () => {
    setShowAuthCard(false);
    pendingConfirmRef.current = false;
  };

  const handleConfirmClick = () => {
    if (isSubmitting) return;
    if (currentCustomer) {
      onConfirm();
      return;
    }
    pendingConfirmRef.current = true;
    setShowAuthCard(true);
  };

  useEffect(() => {
    if (!currentCustomer || !pendingConfirmRef.current) return;
    pendingConfirmRef.current = false;
    setShowAuthCard(false);
    onConfirm();
  }, [currentCustomer, onConfirm]);

  useEffect(() => {
    if (!showAuthCard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAuthCard]);

  return (
    <div className="bp-flow bp-flow--summary">
      {previewBanner}

      <header className="bp-flow__header bp-flow__header--summary">
        <BookingPreviewStepper current={5} mutedPast />
        <h2 className="bp-section-title bp-section-title--summary">5. Resumo do agendamento</h2>
      </header>

      <div className="bp-flow__scroll bp-flow__scroll--summary">
        <div className="bp-summary-card">
          <BookingPreviewSummaryRow
            icon={serviceVisual.icon}
            imageSrc={serviceVisual.imageSrc}
            imageAlt={selectedService?.name}
            iconVariant="purple"
            label="Serviço"
            value={selectedService?.name || '—'}
            sub={formatPrice(selectedService?.price)}
            onEdit={() => onEditStep(1)}
          />
          <BookingPreviewSummaryRow
            icon={User}
            imageSrc={selectedBarber?.foto_perfil}
            imageAlt={selectedBarber?.name}
            fallbackInitial={selectedBarber?.name?.charAt(0)}
            iconVariant="mint"
            label="Profissional"
            value={selectedBarber?.name || '—'}
            onEdit={() => onEditStep(2)}
          />
          <BookingPreviewSummaryRow
            icon={Calendar}
            iconVariant="purple"
            label="Data"
            value={dateFmt.line}
            sub={dateFmt.sub}
            onEdit={() => onEditStep(3)}
          />
          <BookingPreviewSummaryRow
            icon={Clock}
            iconVariant="mint"
            label="Horário"
            value={selectedTime || '—'}
            onEdit={() => onEditStep(3)}
          />
        </div>

        {bookingError && !showAuthCard && <p className="bp-error">{bookingError}</p>}
      </div>

      <footer className="bp-flow__footer bp-flow__footer--summary">
        <div className="bp-security-banner" role="status">
          <span className="bp-security-banner__icon" aria-hidden>
            <ShieldCheck size={20} strokeWidth={2} />
          </span>
          <span>Seus dados estão protegidos e seguros.</span>
        </div>
        <div className="bp-flow__footer-actions bp-flow__footer--dual">
          {onBack ? (
            <button type="button" className="bp-btn-outline" onClick={onBack}>
              Voltar
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="bp-btn-continuar bp-btn-continuar--summary"
            disabled={isSubmitting}
            onClick={handleConfirmClick}
          >
            {isSubmitting ? 'Confirmando...' : 'Confirmar agendamento'}
          </button>
        </div>
      </footer>

      {showAuthCard && !currentCustomer && (
        <div className="bp-auth-overlay" onClick={closeAuthCard} role="presentation">
          <div className="bp-auth-overlay__sheet" onClick={(e) => e.stopPropagation()}>
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
              onAuthSubmit={onAuthSubmit}
              onGoogleLogin={onGoogleLogin}
              onClose={closeAuthCard}
            />
          </div>
        </div>
      )}
    </div>
  );
}
