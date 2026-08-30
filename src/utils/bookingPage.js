export const EMPTY_BOOKING_PAGE_CONFIG = Object.freeze({
  schemaVersion: 1,
  heroTitle: '',
  heroText: '',
  about: '',
  coverAssetId: null,
  galleryAssetIds: [],
});

export const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function normalizeBookingPageConfig(value) {
  const config = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: 1,
    heroTitle: String(config.heroTitle || '').trim(),
    heroText: String(config.heroText || '').trim(),
    about: String(config.about || '').trim(),
    coverAssetId: config.coverAssetId || null,
    galleryAssetIds: Array.isArray(config.galleryAssetIds)
      ? [...new Set(config.galleryAssetIds.filter(Boolean))].slice(0, 5)
      : [],
  };
}

function periodsKey(day) {
  if (!day?.isOpen) return 'closed';
  return (day.periods || []).map((period) => `${period.start}-${period.end}`).join('|') || 'closed';
}

function rangeLabel(days) {
  if (days.length === 1) return WEEKDAY_LABELS[days[0]];
  return `${WEEKDAY_LABELS[days[0]]}–${WEEKDAY_LABELS[days.at(-1)]}`;
}

export function groupWeeklyHours(weeklyHours) {
  const sorted = [...(Array.isArray(weeklyHours) ? weeklyHours : [])]
    .filter((day) => day?.configured && Number.isInteger(Number(day.dayOfWeek)))
    .sort((a, b) => Number(a.dayOfWeek) - Number(b.dayOfWeek));
  const groups = [];
  for (const day of sorted) {
    const dayNumber = Number(day.dayOfWeek);
    const key = periodsKey(day);
    const previous = groups.at(-1);
    if (previous && previous.key === key && previous.days.at(-1) + 1 === dayNumber) {
      previous.days.push(dayNumber);
      continue;
    }
    groups.push({ key, days: [dayNumber], periods: day.periods || [], isOpen: day.isOpen !== false });
  }
  return groups.map((group) => ({
    days: rangeLabel(group.days),
    hours: group.isOpen && group.periods.length
      ? group.periods.map((period) => `${period.start}–${period.end}`).join(' / ')
      : 'Fechado',
    isOpen: group.isOpen && group.periods.length > 0,
  }));
}

export function managerHoursFromPublic(weeklyHours) {
  const byDay = new Map((weeklyHours || []).map((day) => [Number(day.dayOfWeek), day]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => {
    const day = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      configured: Boolean(day?.configured),
      isOpen: day?.isOpen !== false,
      opensAt: day?.opensAt || '09:00',
      closesAt: day?.closesAt || '18:00',
      breakStart: day?.breakStart || '',
      breakEnd: day?.breakEnd || '',
    };
  });
}

export function resolveBookingPreferences({ serviceId, professionalId, services, professionals }) {
  const requestedService = serviceId != null && serviceId !== '';
  const requestedProfessional = professionalId != null && professionalId !== '';
  const service = requestedService
    ? (services || []).find((item) => Number(item.id) === Number(serviceId)) || null
    : null;
  const professional = requestedProfessional
    ? (professionals || []).find((item) => Number(item.id) === Number(professionalId)) || null
    : null;
  const invalid = [];
  if (requestedService && !service) invalid.push('serviço');
  if (requestedProfessional && !professional) invalid.push('profissional');
  return {
    service,
    professional,
    invalidService: requestedService && !service,
    invalidProfessional: requestedProfessional && !professional,
    warning: invalid.length
      ? `A seleção de ${invalid.join(' e ')} não está mais disponível e foi removida.`
      : '',
  };
}
