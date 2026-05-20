import React, { useEffect, useRef } from 'react';
import { ChevronRight, Clock, MoreHorizontal, Scissors, Sparkles, User } from 'lucide-react';
import { scrollToContinueButton } from '../../hooks/usePublicBookingFlow';
import BookingPreviewStepper from './BookingPreviewStepper';

const ICONS = [Scissors, Sparkles, User];
const ICON_BG = ['#ede9fe', '#ccfbf1', '#dbeafe', '#fce7f3', '#fef3c7'];

function ServiceIllustration() {
  return (
    <svg
      className="bp-hero__illus"
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="18" y="12" width="64" height="72" rx="8" stroke="#5D5FEF" strokeWidth="2" fill="#f5f3ff" />
      <path d="M30 28h40M30 40h28M30 52h32" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="58" r="22" stroke="#5D5FEF" strokeWidth="2" fill="#eef2ff" />
      <path d="M88 48v20M78 58h20" stroke="#5D5FEF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function formatDuration(duration) {
  if (!duration) return '';
  const s = String(duration).trim();
  return /\d/.test(s) ? s : `${s}`;
}

function formatPrice(price) {
  const n = Number(price);
  if (Number.isNaN(n)) return '';
  return `R$ ${n.toFixed(2)}`;
}

export default function BookingPreviewServiceStep({
  services,
  selectedService,
  onPickService,
  onContinue,
  previewBanner,
}) {
  const listRef = useRef(null);

  useEffect(() => {
    if (!selectedService) return;
    scrollToContinueButton();
  }, [selectedService?.id]);

  const scrollListToEnd = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  return (
    <div className="bp-flow">
      {previewBanner}

      <header className="bp-flow__header">
        <BookingPreviewStepper current={1} />
        <div className="bp-hero">
          <div className="bp-hero__text">
            <h1 className="bp-hero__title">Agendamento</h1>
            <p className="bp-hero__subtitle">
              Escolha o serviço, profissional, data e horário que melhor atendem você.
            </p>
          </div>
          <ServiceIllustration />
        </div>
        <h2 className="bp-section-title">1. Escolha o serviço</h2>
      </header>

      <div ref={listRef} className="bp-flow__scroll" role="list">
        {services.length === 0 ? (
          <p className="bp-empty">Nenhum serviço disponível no momento.</p>
        ) : (
          services.map((s, index) => {
            const Icon = ICONS[index % ICONS.length];
            const bg = ICON_BG[index % ICON_BG.length];
            const selected = selectedService?.id === s.id;
            const description =
              s.description?.trim() ||
              (s.price != null ? formatPrice(s.price) : 'Serviço disponível para agendamento');

            return (
              <button
                key={s.id}
                type="button"
                role="listitem"
                className={`bp-service-card${selected ? ' bp-service-card--selected' : ''}`}
                onClick={() => onPickService(s)}
              >
                <span className="bp-service-card__icon" style={{ backgroundColor: bg }}>
                  <Icon size={22} strokeWidth={1.75} color="#5D5FEF" />
                </span>
                <span className="bp-service-card__body">
                  <span className="bp-service-card__name">{s.name}</span>
                  <span className="bp-service-card__desc">{description}</span>
                  <span className="bp-service-card__duration">
                    <Clock size={14} strokeWidth={2} aria-hidden />
                    {formatDuration(s.duration) || '—'}
                  </span>
                </span>
                <ChevronRight className="bp-service-card__chevron" size={22} aria-hidden />
              </button>
            );
          })
        )}

        {services.length > 3 && (
          <button type="button" className="bp-service-card bp-service-card--more" onClick={scrollListToEnd}>
            <span className="bp-service-card__icon" style={{ backgroundColor: '#f3f4f6' }}>
              <MoreHorizontal size={22} strokeWidth={2} color="#6b7280" />
            </span>
            <span className="bp-service-card__body">
              <span className="bp-service-card__name">Outros serviços</span>
              <span className="bp-service-card__desc">Ver todos na lista</span>
            </span>
            <ChevronRight className="bp-service-card__chevron" size={22} aria-hidden />
          </button>
        )}
      </div>

      <footer className="bp-flow__footer">
        <button
          type="button"
          className="bp-btn-continuar"
          disabled={!selectedService}
          onClick={onContinue}
        >
          Continuar
        </button>
      </footer>
    </div>
  );
}
