const { timeToHHmm } = require('./bookableProfessionals');

const BOOKING_PAGE_SCHEMA_VERSION = 1;
const BOOKING_PAGE_LIMITS = Object.freeze({
  heroTitle: 120,
  heroText: 320,
  about: 1000,
  gallery: 5,
});
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

class BookingSettingsValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'BookingSettingsValidationError';
    this.issues = issues;
  }
}

function nullableText(value, maxLength, field, issues) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    issues.push(`${field} deve ter no máximo ${maxLength} caracteres.`);
  }
  return text.slice(0, maxLength);
}

function nullableAssetId(value, field, issues) {
  if (value == null || value === '') return null;
  const id = String(value).trim().toLowerCase();
  if (!UUID_RE.test(id)) issues.push(`${field} inválido.`);
  return UUID_RE.test(id) ? id : null;
}

function normalizeBookingPageConfig(input, { throwOnError = true } = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const issues = [];
  const coverAssetId = nullableAssetId(value.coverAssetId, 'coverAssetId', issues);
  const galleryInput = Array.isArray(value.galleryAssetIds) ? value.galleryAssetIds : [];
  const galleryAssetIds = [];

  for (const rawId of galleryInput) {
    const id = nullableAssetId(rawId, 'galleryAssetIds', issues);
    if (id && !galleryAssetIds.includes(id)) galleryAssetIds.push(id);
  }
  if (galleryAssetIds.length > BOOKING_PAGE_LIMITS.gallery) {
    issues.push(`A galeria aceita no máximo ${BOOKING_PAGE_LIMITS.gallery} imagens.`);
  }

  const config = {
    schemaVersion: BOOKING_PAGE_SCHEMA_VERSION,
    heroTitle: nullableText(value.heroTitle, BOOKING_PAGE_LIMITS.heroTitle, 'Título principal', issues),
    heroText: nullableText(value.heroText, BOOKING_PAGE_LIMITS.heroText, 'Texto principal', issues),
    about: nullableText(value.about, BOOKING_PAGE_LIMITS.about, 'Sobre', issues),
    coverAssetId,
    galleryAssetIds: galleryAssetIds.slice(0, BOOKING_PAGE_LIMITS.gallery),
  };

  if (issues.length && throwOnError) {
    throw new BookingSettingsValidationError('Configuração da página inválida.', issues);
  }
  return config;
}

function validateTime(value, label, issues) {
  const text = String(value || '').trim();
  if (!TIME_RE.test(text)) issues.push(`${label} deve estar no formato HH:mm.`);
  return TIME_RE.test(text) ? text : null;
}

function hhmmToDate(value) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function normalizeWeeklyHours(input) {
  if (!Array.isArray(input)) {
    throw new BookingSettingsValidationError('Informe o expediente semanal completo.');
  }
  const issues = [];
  const seen = new Set();
  const rows = [];

  for (const item of input) {
    if (!item || typeof item !== 'object' || item.configured === false) continue;
    const dayOfWeek = Number(item.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || seen.has(dayOfWeek)) {
      issues.push('Cada dia da semana deve aparecer no máximo uma vez, entre 0 e 6.');
      continue;
    }
    seen.add(dayOfWeek);
    const isOpen = item.isOpen !== false;
    const opensAt = validateTime(item.opensAt || '09:00', `Abertura do dia ${dayOfWeek}`, issues);
    const closesAt = validateTime(item.closesAt || '18:00', `Fechamento do dia ${dayOfWeek}`, issues);
    const breakStartRaw = String(item.breakStart || '').trim();
    const breakEndRaw = String(item.breakEnd || '').trim();
    const hasAnyBreak = Boolean(breakStartRaw || breakEndRaw);
    let breakStart = null;
    let breakEnd = null;

    if (hasAnyBreak) {
      if (!breakStartRaw || !breakEndRaw) {
        issues.push(`O intervalo do dia ${dayOfWeek} precisa de início e fim.`);
      } else {
        breakStart = validateTime(breakStartRaw, `Início do intervalo do dia ${dayOfWeek}`, issues);
        breakEnd = validateTime(breakEndRaw, `Fim do intervalo do dia ${dayOfWeek}`, issues);
      }
    }

    if (isOpen && opensAt && closesAt && opensAt >= closesAt) {
      issues.push(`No dia ${dayOfWeek}, a abertura deve ser anterior ao fechamento.`);
    }
    if (isOpen && breakStart && breakEnd) {
      if (breakStart >= breakEnd || breakStart <= opensAt || breakEnd >= closesAt) {
        issues.push(`O intervalo do dia ${dayOfWeek} deve ficar dentro do expediente.`);
      }
    }

    rows.push({
      dayOfWeek,
      isOpen,
      opensAt: opensAt || '09:00',
      closesAt: closesAt || '18:00',
      breakStart,
      breakEnd,
    });
  }

  if (issues.length) {
    throw new BookingSettingsValidationError('Expediente semanal inválido.', [...new Set(issues)]);
  }
  return rows.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function weeklyHoursToPrismaRows(tenantId, weeklyHours) {
  return weeklyHours.map((row) => ({
    tenantId,
    dia_semana: row.dayOfWeek,
    is_aberto: row.isOpen,
    hora_abertura: hhmmToDate(row.opensAt),
    hora_fechamento: hhmmToDate(row.closesAt),
    almoco_inicio: row.breakStart ? hhmmToDate(row.breakStart) : null,
    almoco_fim: row.breakEnd ? hhmmToDate(row.breakEnd) : null,
  }));
}

function serializeWeeklyHours(rows) {
  return (rows || []).map((row) => {
    const opensAt = timeToHHmm(row.hora_abertura);
    const closesAt = timeToHHmm(row.hora_fechamento);
    const breakStart = timeToHHmm(row.almoco_inicio);
    const breakEnd = timeToHHmm(row.almoco_fim);
    const periods = [];
    if (row.is_aberto !== false && opensAt && closesAt) {
      if (breakStart && breakEnd && opensAt < breakStart && breakStart < breakEnd && breakEnd < closesAt) {
        periods.push({ start: opensAt, end: breakStart }, { start: breakEnd, end: closesAt });
      } else {
        periods.push({ start: opensAt, end: closesAt });
      }
    }
    return {
      dayOfWeek: Number(row.dia_semana),
      configured: true,
      isOpen: row.is_aberto !== false,
      opensAt,
      closesAt,
      breakStart,
      breakEnd,
      periods,
    };
  }).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function bookingMediaUrl(slug, assetId) {
  if (!slug || !UUID_RE.test(String(assetId || ''))) return null;
  return `/api/public/booking-media/${encodeURIComponent(slug)}/${encodeURIComponent(assetId)}`;
}

function buildPublicBookingPage(tenant, weeklyHours) {
  const config = normalizeBookingPageConfig(tenant?.bookingPageConfig, { throwOnError: false });
  return {
    schemaVersion: BOOKING_PAGE_SCHEMA_VERSION,
    heroTitle: config.heroTitle || 'Agende seu horário',
    heroText: config.heroText || tenant?.slogan || tenant?.tagline || '',
    about: config.about,
    coverUrl: bookingMediaUrl(tenant?.slug, config.coverAssetId),
    galleryUrls: config.galleryAssetIds.map((id) => bookingMediaUrl(tenant?.slug, id)).filter(Boolean),
    weeklyHours: serializeWeeklyHours(weeklyHours),
  };
}

function bookingPageAssetIds(config) {
  const normalized = normalizeBookingPageConfig(config, { throwOnError: false });
  return [normalized.coverAssetId, ...normalized.galleryAssetIds].filter(Boolean);
}

module.exports = {
  BOOKING_PAGE_LIMITS,
  BOOKING_PAGE_SCHEMA_VERSION,
  BookingSettingsValidationError,
  UUID_RE,
  bookingMediaUrl,
  bookingPageAssetIds,
  buildPublicBookingPage,
  normalizeBookingPageConfig,
  normalizeWeeklyHours,
  serializeWeeklyHours,
  weeklyHoursToPrismaRows,
};
