import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, Clock, ShieldCheck, User } from 'lucide-react';
import BookingPreviewStepper from './BookingPreviewStepper';
import BookingPreviewSummaryRow, { getServiceSummaryVisual } from './BookingPreviewSummaryRow';

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

function CloseIcon() {
  return (
    <svg
      className="bp-auth-card__close-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="#374151"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="bp-btn-google__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C43.68 37.08 46.98 31.38 46.98 24.55z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AuthLoginCard({
  authMode,
  setAuthMode,
  authData,
  setAuthData,
  authError,
  googleBusy,
  onAuthSubmit,
  onGoogleLogin,
  onClose,
}) {
  return (
    <div className="bp-auth-card" role="dialog" aria-labelledby="bp-auth-card-title" aria-modal="true">
      <button type="button" className="bp-auth-card__close" onClick={onClose} aria-label="Fechar">
        <CloseIcon />
      </button>
      <p id="bp-auth-card-title" className="bp-auth-card__title">
        Entre para confirmar
      </p>
      <p className="bp-auth-card__subtitle">Faça login ou crie sua conta para finalizar o agendamento.</p>
      <form className="bp-auth-card__form" onSubmit={onAuthSubmit}>
        {authMode === 'register' && (
          <>
            <input
              className="bp-input"
              type="text"
              placeholder="Nome completo"
              required
              value={authData.name}
              onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
            />
            <input
              className="bp-input"
              type="tel"
              placeholder="WhatsApp"
              required
              value={authData.phone}
              onChange={(e) => setAuthData({ ...authData, phone: e.target.value })}
            />
          </>
        )}
        <input
          className="bp-input"
          type="email"
          placeholder="E-mail"
          required
          value={authData.email}
          onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
        />
        <input
          className="bp-input"
          type="password"
          placeholder="Senha"
          required
          value={authData.password}
          onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
        />
        {authError && <p className="bp-error bp-error--left">{authError}</p>}
        <button type="submit" className="bp-btn-continuar bp-btn-continuar--compact">
          {authMode === 'login' ? 'Entrar' : 'Cadastrar'}
        </button>
      </form>
      {authMode === 'login' && (
        <button type="button" className="bp-btn-google" onClick={onGoogleLogin} disabled={googleBusy}>
          <GoogleIcon />
          <span>{googleBusy ? 'Conectando...' : 'Entrar com Google'}</span>
        </button>
      )}
      <button
        type="button"
        className="bp-link-btn"
        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
      >
        {authMode === 'login' ? 'Criar conta' : 'Já tenho conta'}
      </button>
    </div>
  );
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
  googleBusy,
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
        {onBack ? (
          <button type="button" className="bp-flow__back" onClick={onBack}>
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden />
            Voltar
          </button>
        ) : null}
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
              googleBusy={googleBusy}
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
