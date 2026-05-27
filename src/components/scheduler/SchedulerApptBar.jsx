import React from 'react';
import { isInServiceStatus } from '../../utils/appointmentStatus';
import {
  getBarberColor,
  getBarberInitials,
  getBarberShortName,
} from '../../utils/barberDisplay';

function buildApptLabel(barber, app, statusLabel) {
  const barberName = barber?.name || 'Profissional';
  const customer = app?.customer || 'Cliente';
  const status = statusLabel || app?.status || '';
  return `${barberName} — ${customer} — ${status}`;
}

export default function SchedulerApptBar({
  app,
  barber,
  statusStyle,
  stackCount = 1,
  activeBarbers = [],
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'desktop',
}) {
  const ss = statusStyle;
  const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
  const barberColor = getBarberColor(app.barberId, activeBarbers);
  const initials = getBarberInitials(barber?.name);
  const shortName = getBarberShortName(barber?.name);
  const ariaLabel = buildApptLabel(barber, app, ss?.label);

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        className={`scheduler-mobile-macro-card scheduler-appt-bar scheduler-appt-bar--interactive${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        disabled={!actionable}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{
          background: ss.bg,
          borderColor: ss.border,
          opacity: app.status === 'Cancelado' ? 0.5 : 1,
          cursor: actionable ? 'pointer' : 'default',
          minHeight: '47px',
          width: '100%',
        }}
      >
        <div
          className="scheduler-mobile-macro-avatar"
          style={{ background: barberColor, color: '#fff' }}
          aria-hidden
        >
          {barber?.foto_perfil ? (
            <img src={barber.foto_perfil} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initials
          )}
        </div>
        <div className="scheduler-mobile-macro-text">
          <div
            className={`scheduler-mobile-macro-customer${app.status === 'Cancelado' ? ' scheduler-appt-bar__name--cancelled' : ''}`}
          >
            {app.customer}
          </div>
          <div className="scheduler-mobile-macro-meta">
            {shortName || 'Profissional'} · {ss.label}
          </div>
        </div>
        <span
          className="scheduler-appt-bar__status-dot"
          style={{ background: ss.badge }}
          title={ss.label}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={actionable ? 0 : -1}
      className={`scheduler-appt-bar fade-in${actionable ? ' scheduler-appt-bar--interactive' : ' scheduler-appt-bar--muted'}${isInServiceStatus(app.status) ? ' scheduler-appt--in-service' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        background: ss.bg,
        borderColor: ss.border,
      }}
    >
      <span className="scheduler-appt-bar__accent" style={{ background: barberColor }} aria-hidden />
      <span className="scheduler-appt-bar__avatar" style={{ background: barberColor }} aria-hidden>
        {initials}
      </span>
      <span
        className={`scheduler-appt-bar__name${app.status === 'Cancelado' ? ' scheduler-appt-bar__name--cancelled' : ''}`}
        title={app.customer}
      >
        {app.customer}
      </span>
      {stackCount === 1 && shortName && (
        <span className="scheduler-appt-bar__meta" title={barber?.name}>
          {shortName}
        </span>
      )}
      <span
        className="scheduler-appt-bar__status-dot"
        style={{ background: ss.badge }}
        title={ss.label}
        aria-hidden
      />
    </div>
  );
}
