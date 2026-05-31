/** Data local YYYY-MM-DD (fuso do navegador). */
export function toIsoLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Hoje no fuso local (preferir em vez de toISOString().slice(0, 10)). */
export function todayIsoLocal() {
  return toIsoLocal(new Date());
}

/**
 * Interpreta YYYY-MM-DD como meio-dia local (evita bug UTC de new Date('2026-05-31')).
 */
export function parseLocalDateIso(isoYmd) {
  return new Date(`${isoYmd}T12:00:00`);
}

/**
 * Intervalo inclusivo para KPIs do dashboard (7, 15, 30 dias ou só hoje).
 * @param {string} endIso YYYY-MM-DD (geralmente hoje)
 * @param {number} dayCount 0 = só endIso; 7 = últimos 7 dias incluindo endIso
 */
export function getLocalPeriodRange(endIso, dayCount) {
  if (!endIso) {
    const t = todayIsoLocal();
    return { start: t, end: t };
  }
  if (!dayCount) {
    return { start: endIso, end: endIso };
  }
  const end = parseLocalDateIso(endIso);
  const start = parseLocalDateIso(endIso);
  start.setDate(start.getDate() - Math.max(dayCount - 1, 0));
  return { start: toIsoLocal(start), end: toIsoLocal(end) };
}
