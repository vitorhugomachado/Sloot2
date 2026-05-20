export function formatDateChip(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return { weekday: cap, day: String(d), month: monthCap };
}

export function formatSummaryDate(iso) {
  if (!iso) return { line: '—', sub: '' };
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const line = date.toLocaleDateString('pt-BR');
  return { line, sub: cap };
}

export function formatPrice(price) {
  const n = Number(price);
  if (Number.isNaN(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDuration(duration) {
  if (!duration) return '';
  const s = String(duration).trim();
  return /\d/.test(s) ? s : `${s}`;
}

export function getDesktopStepperStep({ selectedService, selectedBarber, selectedDate, selectedTime }) {
  if (!selectedService) return 1;
  if (!selectedBarber) return 2;
  if (!selectedDate) return 3;
  if (!selectedTime) return 4;
  return 5;
}
