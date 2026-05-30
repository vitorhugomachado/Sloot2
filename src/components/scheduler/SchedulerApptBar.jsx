import React from 'react';
import { getSchedulerStatusClass } from '../../utils/appointmentStatus';
import { getBarberInitials, getBarberShortName } from '../../utils/barberDisplay';

function buildApptLabel(barber, app, statusLabel) {
  const barberName = barber?.name || 'Profissional';
  const customer = app?.customer || 'Cliente';
  const status = statusLabel || app?.status || '';
  return `${barberName} — ${customer} — ${status}`;
}

function BarberAvatar({ barber, className }) {
  const initials = getBarberInitials(barber?.name);
  const hasPhoto = Boolean(barber?.foto_perfil);

  return (
    <span
      className={`${className}${hasPhoto ? ' scheduler-appt-bar__avatar--photo' : ' scheduler-appt-bar__avatar--initials'}`}
      aria-hidden
    >
      {hasPhoto ? <img src={barber.foto_perfil} alt="" /> : initials}
    </span>
  );
}

export default function SchedulerApptBar({
  app,
  barber,
  statusStyle,
  onClick,
  onMouseEnter,
  onMouseLeave,
  variant = 'desktop',
}) {
  const ss = statusStyle;
  const actionable = app.status !== 'Finalizado' && app.status !== 'Cancelado';
  const statusClass = getSchedulerStatusClass(app.status);
  const shortName = getBarberShortName(barber?.name);
  const ariaLabel = buildApptLabel(barber, app, ss?.label);

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        className={`scheduler-mobile-macro-card scheduler-appt-bar scheduler-appt-bar--interactive${statusClass ? ` ${statusClass}` : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        disabled={!actionable}
        aria-label={ariaLabel}
        title={ariaLabel}
        style={{
          background: ss.bg,
          borderColor: ss.border,
          cursor: actionable ? 'pointer' : 'default',
          minHeight: '47px',
          width: '100%',
        }}
      >
        <BarberAvatar barber={barber} className="scheduler-mobile-macro-avatar scheduler-appt-bar__avatar" />
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
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={actionable ? 0 : -1}
      className={`scheduler-appt-bar scheduler-appt-bar--model-a fade-in${actionable ? ' scheduler-appt-bar--interactive' : ' scheduler-appt-bar--muted'}${statusClass ? ` ${statusClass}` : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="scheduler-appt-bar__accent" aria-hidden />
      <BarberAvatar barber={barber} className="scheduler-appt-bar__avatar" />
      <span
        className={`scheduler-appt-bar__name${app.status === 'Cancelado' ? ' scheduler-appt-bar__name--cancelled' : ''}`}
        title={app.customer}
      >
        {app.customer}
      </span>
    </div>
  );
}
