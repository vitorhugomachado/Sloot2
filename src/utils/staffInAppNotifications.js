import { readPushPreference } from './staffPushNotifications';

function formatAppointmentBody(app) {
  const date = app.date?.split('-').reverse().join('/') || app.date || '';
  const time = String(app.time || '').slice(0, 5);
  return `${app.customer} — ${app.service} — ${date} às ${time}`;
}

/**
 * Notificação local (aba aberta) quando push do SO não está disponível.
 * Complementa Web Push — não substitui notificações com navegador fechado.
 */
export function notifyStaffNewOnlineAppointments(appointments, tenantSlug, tracker) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!readPushPreference(tenantSlug)) return;

  const list = Array.isArray(appointments) ? appointments : [];
  const ids = list.map((app) => Number(app.id)).filter((id) => Number.isFinite(id));

  if (!tracker.initialized) {
    tracker.initialized = true;
    tracker.knownIds = new Set(ids);
    return;
  }

  const known = tracker.knownIds || new Set();
  for (const app of list) {
    const id = Number(app.id);
    if (!Number.isFinite(id) || known.has(id)) continue;
    if (!app.customer_id) continue;
    if (!['Agendado', 'Pendente'].includes(app.status)) continue;

    try {
      new Notification('Novo agendamento', {
        body: formatAppointmentBody(app),
        icon: '/favicon.svg',
        tag: `appointment-${id}`,
      });
    } catch {
      // ignore — browser may block without user gesture
    }
    known.add(id);
  }

  for (const id of ids) known.add(id);
  tracker.knownIds = known;
}
