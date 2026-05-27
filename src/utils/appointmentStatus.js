const IN_SERVICE_COLOR = '#93C5FD';

export function isInServiceStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return s === 'em progresso' || s === 'em atendimento';
}

/** Estilo para cards da grade / Scheduler (bg, border, badge, label). */
export function getAppointmentStatusStyle(status) {
  const s = String(status || '').trim();
  switch (s) {
    case 'Finalizado':
      return {
        bg: 'rgba(5, 150, 105, 0.1)',
        border: 'rgba(5, 150, 105, 0.3)',
        badge: '#059669',
        label: 'Pago',
      };
    case 'Em progresso':
    case 'Em atendimento':
      return {
        bg: '#DBEAFE',
        border: '#93C5FD',
        badge: '#3B82F6',
        label: 'Atd.',
      };
    case 'Cancelado':
      return {
        bg: 'rgba(239, 68, 68, 0.08)',
        border: 'rgba(239, 68, 68, 0.3)',
        badge: '#ef4444',
        label: 'Canc.',
      };
    case 'Confirmado':
      return {
        bg: 'rgba(13, 148, 136, 0.12)',
        border: 'rgba(13, 148, 136, 0.35)',
        badge: '#0d9488',
        label: 'Conf.',
      };
    case 'Agendado':
      return {
        bg: 'var(--panel-bg)',
        border: 'var(--border-color)',
        badge: 'var(--brand-400)',
        label: 'Ag',
      };
    default:
      if (isInServiceStatus(s)) {
        return {
          bg: '#DBEAFE',
          border: '#93C5FD',
          badge: '#3B82F6',
          label: 'Atd.',
        };
      }
      return {
        bg: 'var(--panel-bg)',
        border: 'var(--border-color)',
        badge: 'var(--brand-400)',
        label: 'Ag',
      };
  }
}

/** Config para timeline Dashboard (color, lineColor, label). */
export function getAppointmentStatusConfig(status) {
  const s = String(status || '').trim();
  switch (s) {
    case 'Finalizado':
      return { color: '#16a34a', lineColor: 'rgba(22, 163, 74, 0.4)', label: 'Pago' };
    case 'Em progresso':
    case 'Em atendimento':
      return {
        color: IN_SERVICE_COLOR,
        lineColor: 'rgba(147, 197, 253, 0.55)',
        label: 'Em atendimento',
      };
    case 'Cancelado':
      return { color: '#dc2626', lineColor: 'rgba(220, 38, 38, 0.4)', label: 'Cancelado' };
    case 'Agendado':
      return { color: '#64748b', lineColor: 'rgba(100, 116, 139, 0.35)', label: 'Agendado' };
    case 'Confirmado':
      return { color: '#0d9488', lineColor: 'rgba(13, 148, 136, 0.4)', label: 'Confirmado' };
    default:
      if (isInServiceStatus(s)) {
        return {
          color: IN_SERVICE_COLOR,
          lineColor: 'rgba(147, 197, 253, 0.55)',
          label: 'Em atendimento',
        };
      }
      return { color: '#64748b', lineColor: 'rgba(100, 116, 139, 0.35)', label: s || 'Agendado' };
  }
}

export { IN_SERVICE_COLOR };
