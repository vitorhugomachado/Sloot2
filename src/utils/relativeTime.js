/** Formata timestamp em texto relativo (pt-BR). */
export function formatRelativeTime(timestamp, now = Date.now()) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || ts <= 0) return '';

  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 10) return 'agora';
  if (diffSec < 60) return `há ${diffSec}s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `há ${diffHour} h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'há 1 dia';
  if (diffDay < 7) return `há ${diffDay} dias`;

  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
