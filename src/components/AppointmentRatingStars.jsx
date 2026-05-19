import React, { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * @param {{
 *   value?: number | null,
 *   onRate?: (rating: number) => void | Promise<void>,
 *   disabled?: boolean,
 *   saving?: boolean,
 * }} props
 */
export default function AppointmentRatingStars({ value = null, onRate, disabled = false, saving = false }) {
  const [hover, setHover] = useState(null);
  const interactive = !disabled && typeof onRate === 'function';
  const active = hover ?? value ?? 0;

  return (
    <div className={`customer-portal-rating ${!interactive ? 'customer-portal-rating--static' : ''}`}>
      <span className="customer-portal-rating__label">Avalie o atendimento</span>
      <div
        className="customer-portal-rating__stars"
        aria-label="Classificação por estrelas"
        onMouseLeave={() => interactive && setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={`customer-portal-rating__star ${i <= active ? 'customer-portal-rating__star--on' : ''}`}
            disabled={!interactive || saving}
            aria-label={`${i} estrelas`}
            onMouseEnter={() => interactive && setHover(i)}
            onFocus={() => interactive && setHover(i)}
            onBlur={() => interactive && setHover(null)}
            onClick={() => interactive && onRate(i)}
          >
            <Star size={22} strokeWidth={2} aria-hidden />
          </button>
        ))}
      </div>
      {saving && <span className="customer-portal-rating__hint">A guardar…</span>}
      {!saving && value != null && value >= 1 && (
        <span className="customer-portal-rating__saved">Obrigado!</span>
      )}
    </div>
  );
}
