import React from 'react';
import { ChevronRight, Scissors, Sparkles, User } from 'lucide-react';

const SERVICE_ICONS = [Scissors, Sparkles, User];

export function getServiceSummaryVisual(services, selectedService) {
  const index = selectedService ? services.findIndex((s) => s.id === selectedService.id) : -1;
  const iconIndex = index >= 0 ? index : 0;
  const imageSrc =
    selectedService?.foto ??
    selectedService?.foto_perfil ??
    selectedService?.image_url ??
    null;
  return {
    icon: SERVICE_ICONS[iconIndex % SERVICE_ICONS.length],
    imageSrc: imageSrc || undefined,
  };
}

export default function BookingPreviewSummaryRow({
  icon: Icon,
  iconVariant = 'purple',
  label,
  value,
  sub,
  onEdit,
  imageSrc,
  imageAlt,
  fallbackInitial,
}) {
  const showPhoto = Boolean(imageSrc);
  const showInitial = !showPhoto && Boolean(fallbackInitial);
  const showIcon = !showPhoto && !showInitial && Icon;

  return (
    <button type="button" className="bp-summary-row" onClick={onEdit}>
      <span
        className={[
          'bp-summary-row__icon',
          `bp-summary-row__icon--${iconVariant}`,
          showPhoto && 'bp-summary-row__icon--photo',
          showInitial && 'bp-summary-row__icon--initial',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {showPhoto ? (
          <img src={imageSrc} alt={imageAlt || ''} />
        ) : showInitial ? (
          <span className="bp-summary-row__initial" aria-hidden>
            {fallbackInitial}
          </span>
        ) : showIcon ? (
          <Icon size={20} strokeWidth={1.85} aria-hidden />
        ) : null}
      </span>
      <span className="bp-summary-row__text">
        <span className="bp-summary-row__label">{label}</span>
        <span className="bp-summary-row__value">{value}</span>
        {sub ? <span className="bp-summary-row__sub">{sub}</span> : null}
      </span>
      <ChevronRight size={22} className="bp-summary-row__chev" strokeWidth={2} aria-hidden />
    </button>
  );
}
