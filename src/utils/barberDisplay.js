/** Paleta compartilhada (mesma ordem do Dashboard). */
export const BARBER_DISPLAY_COLORS = ['#2563EB', '#10B981', '#f59e0b', '#ec4899', '#64748B'];

export const BARBER_DISPLAY_COLOR_FALLBACK = '#94a3b8';

/**
 * Índice estável do barbeiro na lista (ex.: activeBarbers).
 * @returns {number} índice >= 0 ou -1 se não encontrado
 */
export function getBarberColorIndex(barberId, barbers) {
  if (barberId == null || !Array.isArray(barbers)) return -1;
  return barbers.findIndex((b) => String(b.id) === String(barberId));
}

/** Cor do barbeiro com base na ordem em `barbers`. */
export function getBarberColor(barberId, barbers) {
  const idx = getBarberColorIndex(barberId, barbers);
  if (idx < 0) return BARBER_DISPLAY_COLOR_FALLBACK;
  return BARBER_DISPLAY_COLORS[idx % BARBER_DISPLAY_COLORS.length];
}

/** Iniciais para avatar: "Romario Silva" → "RS", "Romario" → "RO". */
export function getBarberInitials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    const word = parts[0];
    return word.length >= 2 ? word.slice(0, 2).toUpperCase() : word.charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Primeiro nome (comportamento usado hoje no Scheduler). */
export function getBarberShortName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0];
}
