/** Paleta compartilhada (mesma ordem do Dashboard). */
export const BARBER_DISPLAY_COLORS = ['#2563EB', '#10B981', '#f59e0b', '#ec4899', '#64748B'];

export const BARBER_DISPLAY_COLOR_FALLBACK = '#94a3b8';

/** Tema pastel por profissional na agenda web (barra + avatar fallback). */
export const SCHEDULER_BARBER_THEMES = [
  { accent: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { accent: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { accent: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  { accent: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { accent: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
];

const SCHEDULER_THEME_FALLBACK = {
  accent: BARBER_DISPLAY_COLOR_FALLBACK,
  bg: '#f1f5f9',
  border: '#cbd5e1',
};

/**
 * Índice estável do barbeiro na lista (ex.: activeBarbers).
 * @returns {number} índice >= 0 ou -1 se não encontrado
 */
export function getBarberColorIndex(barberId, barbers) {
  if (barberId == null || !Array.isArray(barbers)) return -1;
  return barbers.findIndex((b) => String(b.id) === String(barberId));
}

/** Tema visual do barbeiro na agenda (accent + fundos pastel). */
export function getBarberTheme(barberId, barbers) {
  const idx = getBarberColorIndex(barberId, barbers);
  if (idx < 0) return SCHEDULER_THEME_FALLBACK;
  return SCHEDULER_BARBER_THEMES[idx % SCHEDULER_BARBER_THEMES.length];
}

/** Cor de destaque do barbeiro (accent do tema da agenda). */
export function getBarberColor(barberId, barbers) {
  return getBarberTheme(barberId, barbers).accent;
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
