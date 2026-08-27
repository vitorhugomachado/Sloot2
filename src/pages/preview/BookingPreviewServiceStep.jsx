import React, { useEffect } from 'react';
import { Check, ChevronRight, Clock, Scissors, Sparkles, User } from 'lucide-react';
import { scrollToContinueButton } from '../../hooks/usePublicBookingFlow';
import BookingPreviewFlowLayout from './BookingPreviewFlowLayout';

const ICONS = [Scissors, Sparkles, User];

function formatDuration(duration) {
  if (!duration) return '';
  const s = String(duration).trim();
  return /\d/.test(s) ? s : `${s}`;
}

function formatPrice(price) {
  const n = Number(price);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function BookingPreviewServiceStep({
  services,
  selectedService,
  onPickService,
  onBack,
  onContinue,
  previewBanner,
  mobileHubStyle = false,
  businessTitle,
  businessTagline,
}) {
  const mobileHubSteps = [
    { id: 1, label: 'Serviço' },
    { id: 2, label: 'Profissional' },
    { id: 3, label: 'Data e horário' },
    { id: 4, label: 'Confirmação' },
  ];

  useEffect(() => {
    if (!selectedService) return;
    scrollToContinueButton();
  }, [selectedService]);

  return (
    <BookingPreviewFlowLayout
      stepperCurrent={1}
      previewBanner={previewBanner}
      showBack={mobileHubStyle ? Boolean(onBack) : false}
      onBack={onBack}
      onContinue={onContinue}
      continueDisabled={!selectedService}
      selectionId={selectedService?.id}
      brandTitle={mobileHubStyle ? businessTitle : null}
      brandTagline={mobileHubStyle ? businessTagline : null}
      introTitle={mobileHubStyle ? 'Agende seu horário' : null}
      introSubtitle={mobileHubStyle ? 'Escolha o serviço ideal para você.' : null}
      stepperSteps={mobileHubStyle ? mobileHubSteps : undefined}
    >
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
              <span className="bp-service-card__price">{formatPrice(s.price)}</span>
              <span className="bp-service-card__check" aria-hidden>
                <Check size={21} strokeWidth={2.5} />
              </span>
              <ChevronRight className="bp-service-card__chevron" size={22} aria-hidden />
            </button>
          );
        })
      )}
    </BookingPreviewFlowLayout>
  );
}
