/**
 * Devolve URL absoluta para abrir o perfil/link público.
 * Aceita URL completa, @handle ou nome de utilizador.
 */
export function normalizeInstagramUrl(input) {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@+/, '').replace(/^\//, '');
  if (!handle) return '';
  return `https://instagram.com/${handle}`;
}

export function normalizeFacebookUrl(input) {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const path = s.replace(/^\//, '');
  if (!path) return '';
  return `https://facebook.com/${path}`;
}

/** Aceita URL completa, wa.me, wa.link/..., ou apenas dígitos (com DDI ou BR com DDD). */
export function normalizeWhatsappUrl(input) {
  const s = String(input ?? '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;

  const digits = s.replace(/\D/g, '');
  if (digits.length >= 10) {
    let n = digits;
    if ((n.length === 10 || n.length === 11) && !n.startsWith('55')) {
      n = `55${n}`;
    }
    return `https://wa.me/${n}`;
  }

  const path = s.replace(/^\/+/, '');
  return path.includes('://') ? path : `https://${path}`;
}
