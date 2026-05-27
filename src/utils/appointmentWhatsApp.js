export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits.startsWith('55')) digits = `55${digits}`;
  return digits;
}

export function toBrDate(isoDate) {
  if (!isoDate || !isoDate.includes('-')) return isoDate || '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function buildWhatsAppConfirmMessage(app) {
  const msg = `Olá ${app.customer}, tudo bem? Poderia confirmar seu agendamento em ${toBrDate(app.date)} às ${app.time}?`;
  return encodeURIComponent(msg);
}

export function openWhatsAppConfirm(app) {
  const normalizedPhone = normalizePhoneForWhatsApp(app.phone);
  if (!normalizedPhone) return false;
  const encodedMessage = buildWhatsAppConfirmMessage(app);
  const url = `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
