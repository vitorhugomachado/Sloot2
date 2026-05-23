import React, { useEffect } from 'react';
import { ChevronRight, Clock, Scissors, Sparkles, User } from 'lucide-react';
import { scrollToContinueButton } from '../../hooks/usePublicBookingFlow';
import BookingPreviewFlowLayout from './BookingPreviewFlowLayout';

const ICONS = [Scissors, Sparkles, User];

function ServiceIllustration() {
  return (
    <svg
      className="bp-hero__illus"
      viewBox="0 0 120 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="18" y="12" width="64" height="72" rx="8" stroke="#252f3d" strokeWidth="2" fill="#f1f3f6" />
      <path d="M30 28h40M30 40h28M30 52h32" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="88" cy="58" r="22" stroke="#252f3d" strokeWidth="2" fill="#eef2f7" />
      <path d="M88 48v20M78 58h20" stroke="#252f3d" strokeWidth="2" strokeLinecap="round" />
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
  useEffect(() => {
    if (!selectedService) return;
    scrollToContinueButton();
  }, [selectedService?.id]);

  return (
    <BookingPreviewFlowLayout
      stepperCurrent={1}
      previewBanner={previewBanner}
      showBack={false}
      onContinue={onContinue}
      continueDisabled={!selectedService}
      selectionId={selectedService?.id}
    >
      <div className="bp-hero bp-hero--in-scroll">
        <div className="bp-hero__text">
          <h1 className="bp-hero__title">Agendamento</h1>
          <p className="bp-hero__subtitle">
            Escolha o serviço, profissional, data e horário que melhor atendem você.
          </p>
        </div>
        <ServiceIllustration />
      </div>
      <h2 className="bp-section-title">1. Escolha o serviço</h2>

      {services.length === 0 ? (
        <p className="bp-empty">Nenhum serviço disponível no momento.</p>
      ) : (
        services.map((s, index) => {
          const Icon = ICONS[index % ICONS.length];
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
              <span className="bp-service-card__icon">
                <Icon size={22} strokeWidth={1.75} aria-hidden />
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
    </BookingPreviewFlowLayout>
  );
}
