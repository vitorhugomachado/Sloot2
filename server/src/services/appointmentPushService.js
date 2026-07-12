const prisma = require('../lib/prisma');
const { isWebPushConfigured, sendPushNotification } = require('../lib/webPush');

function isCustomerOriginatedBooking(req) {
  return !req.user || req.user.role === 'customer';
}

function formatAppointmentDate(dateIso) {
  const parts = String(dateIso || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return String(dateIso || '');
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function buildNotificationPayload({ appointment, tenantSlug }) {
  const barberName = appointment?.Barber?.name || 'profissional';
  const dateLabel = formatAppointmentDate(appointment.date);
  const timeLabel = String(appointment.time || '').slice(0, 5);
  const body = `${appointment.customer} — ${appointment.service} — ${dateLabel} às ${timeLabel} com ${barberName}`;
  const url = `/${tenantSlug}/dashboard/scheduler`;

  return {
    title: 'Novo agendamento',
    body,
    url,
    tag: `appointment-${appointment.id}`,
    data: {
      appointmentId: appointment.id,
      url,
    },
  };
}

async function removeExpiredSubscription(endpoint) {
  if (!endpoint) return;
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  } catch (error) {
    console.error('Failed to remove expired push subscription:', error?.message || error);
  }
}

async function sendNewAppointmentPush({ tenantId, appointment, tenantSlug }) {
  if (!isWebPushConfigured()) return;
  if (!tenantId || !appointment?.id) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      tenantId,
      barber: {
        deletedAt: null,
        status: 'Ativo',
        OR: [{ role: 'Gerente' }, { id: appointment.barberId }],
      },
    },
  });

  if (!subscriptions.length) return;

  const payload = buildNotificationPayload({ appointment, tenantSlug });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const result = await sendPushNotification(subscription, payload);
      if (result.expired) {
        await removeExpiredSubscription(subscription.endpoint);
      } else if (!result.ok && !result.skipped) {
        console.error(
          'Push notification failed:',
          result.statusCode || result.error?.message || result.error,
        );
      }
    }),
  );
}

function scheduleNewAppointmentPush({ req, appointment, tenantSlug }) {
  if (!isCustomerOriginatedBooking(req)) return;

  const tenantId = appointment?.tenantId;
  if (!tenantId) return;

  setImmediate(() => {
    sendNewAppointmentPush({ tenantId, appointment, tenantSlug }).catch((error) => {
      console.error('sendNewAppointmentPush error:', error);
    });
  });
}

module.exports = {
  isCustomerOriginatedBooking,
  scheduleNewAppointmentPush,
  sendNewAppointmentPush,
};
